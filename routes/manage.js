const Router = require("koa-router");
const mime = require('mime-types')
const path = require('path');
const crypto = require('crypto')
const { createCache } = require('cache-manager')
const jwt = require('jsonwebtoken');
const { stringify } = require("csv-stringify");

const { decryptPrivateKey, encryptPrivateKey, generateKeyPair, decryptWithPrivateKey, encryptWithPublicKey } = require('../util/crypt.js');
const { createCampaigne, getOrders, insertItem, updateItem, deleteItem, getCampaine, getItemsForcampaignId, getItem, updateOrder, getOrder, getLimitedOrders, getOrdersCount } = require('../util/db.js');
const { resizeAndSaveImage, deleteExistingImage } = require("../util/image.js");
const { render } = require("../util/render.js");

const memoryCache = createCache();

const IS_PRODUCTION = (process.env.IS_PRODUCTION | "true") == "true" ? true : false;
const JWT_SECRET = process.env.JWT_SECRET

function routeManage(app) {

    const router = new Router();

    router.get('/manage/create', async (ctx) => {
        await render(ctx, 'admin/create-campaign');
    });

    router.get('/manage/:campaignId/login', async (ctx) => {
        const campaignId = ctx.params.campaignId
        const campaign = getCampaine(campaignId);
        if (campaign) {
            await render(ctx, 'admin/prompt-password', { campaign, wrongPassword: false });
        } else {
            ctx.throw(404, 'Campaign not found!');
        }
    });

    router.post('/manage/create', async (ctx) => {
        const { password, name, repeatPassword } = ctx.request.body;

        if (!password || password.length < 4)
            ctx.throw(404, 'Password ist not defined or too short!');
        else if (password != repeatPassword)
            ctx.throw(404, 'Passwords don\'t match!');
        else if (!name || name.length < 4)
            ctx.throw(404, 'Name ist not defined or too short!');
        else {
            const { publicKey, privateKey } = generateKeyPair();

            const encryptedBlob = encryptPrivateKey(privateKey, password);

            const campaignId = createCampaigne(publicKey, encryptedBlob, name);

            await login(campaignId, privateKey, ctx);
            ctx.redirect(`/manage/${campaignId}/`);
        }
    });

    router.post('/manage/:campaignId', async (ctx) => {
        const { password } = ctx.request.body;

        const campaignId = ctx.params.campaignId
        const campaign = getCampaine(campaignId);

        try {
            const privateKey = decryptPrivateKey(password, campaign.encryptedPrivateKey);
            await login(campaignId, privateKey, ctx);
            ctx.redirect(`/manage/${campaignId}/`);
        } catch (error) {
            await render(ctx, 'admin/prompt-password', { campaignId: ctx.params.campaignId, wrongPassword: true });
        }

    });

    router.get('/manage/:campaignId', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;

        const decryptedPrivateKey = ctx.state.decryptedPrivateKey;
        const orderCount = getOrdersCount(campaign.id);

        await render(ctx, 'admin/view-campaign', { campaign, decryptedPrivateKey, orderCount });
    });

    router.get('/manage/:campaignId/download', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;

        const decryptedPrivateKey = ctx.state.decryptedPrivateKey;

        const ordersRaw = getOrders(campaign.id, decryptedPrivateKey);
        const orders = [
            ["id", "whoIsOrdering", "email", "adress", "country", "items"],
            ...ordersRaw.map(orderData => {
                const decryptedOrder = decryptWithPrivateKey(decryptedPrivateKey, orderData.encryptedDetails);
                const data = JSON.parse(decryptedOrder)
                const id = data.id
                const address = data.address
                const items = data.items
                const details = data.details
                return [
                    id,
                    details.whoIsOrdering,
                    details.email,
                    `${address.name}, ${address.street} ${address.streetNumber}, ${address.postalCode} ${address.city}`,
                    address.country,
                    [...items.map(item => { return `${item.quantity}x ${item.name}` })].join(", ")
                ]
            })
        ]

        const stringifier = stringify(orders);
        ctx.set('Content-Type', 'text/csv');
        ctx.set('Content-Disposition', `attachment; filename="${campaign.name}.csv"`);
        ctx.body = stringifier
    });

    router.get('/manage/:campaignId/orders', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;

        const decryptedPrivateKey = ctx.state.decryptedPrivateKey;

        const limit = 35;
        const orderCount = getOrdersCount(campaign.id);
        const maxPage = Math.ceil(orderCount / limit);
        const page = ctx.query.page ? Number.parseInt(ctx.query.page) : 1
        const offset = (page - 1) * limit

        if (page > maxPage || !Number.isInteger(page)) {
            return ctx.redirect(`/manage/${campaign.id}/orders/?page=${maxPage}`);
        }

        const ordersRaw = getLimitedOrders(campaign.id, limit, offset);
        const orders = ordersRaw.map(orderData => {
            const decryptedOrder = decryptWithPrivateKey(decryptedPrivateKey, orderData.encryptedDetails);
            return { ...JSON.parse(decryptedOrder), id: orderData.id, time: orderData.time };
        });
        await render(ctx, 'admin/view-orders', { campaign: ctx.state.campaign, orders, page: page, maxPage: maxPage });
    });

    router.get('/manage/:campaignId', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;
        await render(ctx, 'edit-campaign', { campaign });
    });

    router.get('/manage/:campaignId/items', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;
        const items = getItemsForcampaignId(campaign.id)
        await render(ctx, 'admin/manage-items', { campaign: campaign, items });
    });

    router.get('/manage/:campaignId/items/add', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;
        await render(ctx, 'admin/item-form', { campaignId: campaign.id, item: null });
    });

    router.get('/manage/:campaignId/items/edit/:itemId', auchMiddleware, async (ctx) => {
        const campaign = ctx.state.campaign;
        const itemId = ctx.params.itemId;
        let item = getItem(itemId)
        if (!item)
            ctx.throw(404, 'Item not found');
        else
            await render(ctx, 'admin/item-form', { campaignId: campaign.id, item });
    });


    router.post(['/manage/:campaignId/items/add', '/manage/:campaignId/items/:itemId'], auchMiddleware, async (ctx) => {
        const { itemId } = ctx.params;
        const file = ctx.request.files.image;
        const { name, minQuantity, maxQuantity } = ctx.request.body;
        const campaign = ctx.state.campaign;

        let newFilename;
        if (file && file.size > 0) {
            if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                throw new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.');
            }

            if (itemId) {
                const item = getItem(itemId);

                deleteExistingImage(item.imageName);
            }
            const ext = path.extname(file.originalFilename);
            newFilename = `${Date.now()}${ext}`;
            await resizeAndSaveImage(file, newFilename);
        } else {
            const item = getItem(itemId);
            newFilename = item.imageName;
        }

        if (itemId) {
            updateItem(name, minQuantity, maxQuantity, newFilename, itemId);
        } else {
            insertItem(campaign.id, name, minQuantity, maxQuantity, newFilename);
        }
        ctx.redirect(`/manage/${campaign.id}/items`)
    });

    router.post('/manage/:campaignId/items/delete/:itemId', auchMiddleware, async (ctx) => {
        const { itemId } = ctx.params;
        const campaign = ctx.state.campaign;

        deleteExistingImage(getItem(itemId).imageName)

        deleteItem(itemId);

        ctx.redirect(`/manage/${campaign.id}/items`);
    });

    router.post('/api/manage/:campaignId/orders/update/:orderId', auchMiddleware, async (ctx) => {
        const { orderId } = ctx.params;
        const campaign = ctx.state.campaign;
        const decryptedPrivateKey = ctx.state.decryptedPrivateKey;

        const { status, notes } = ctx.request.body;

        const data = { ...JSON.parse(decryptWithPrivateKey(decryptedPrivateKey, getOrder(orderId).encryptedDetails)), id: orderId };
        data.status = status
        data.notes = notes

        const encryptedData = encryptWithPublicKey(campaign.publicKey, JSON.stringify(data))

        updateOrder(orderId, encryptedData);

        ctx.body = { status: "Ok" };
    });

    app.use(router.routes()).use(router.allowedMethods());
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

async function login(campaignId, privateKey, ctx) {
    const userId = await getUserId(ctx)
    await memoryCache.set(`key-${campaignId}-${userId}`, { privateKey: privateKey }, 1000 * 60 * 15);
}

async function getUserId(ctx) {

    const { userId, cookie } = await (async () => {
        try {
            const currentCookie = ctx.cookies.get(`user-id`)
            if (currentCookie == undefined)
                throw new Error("No cookie defined.")
            const userId = await jwt.verify(currentCookie, JWT_SECRET)
            if (userId == undefined)
                throw new Error("No userId defined.")
            return { userId, cookie: currentCookie }
        } catch (error) {
            const newUserId = crypto.randomUUID()
            return { userId: newUserId, cookie: await jwt.sign(newUserId, JWT_SECRET) }
        }
    })()
    ctx.cookies.set(`user-id`, cookie, { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, secure: IS_PRODUCTION, sameSite: "strict" })
    return userId

}


async function auchMiddleware(ctx, next) {
    const campaignId = ctx.params.campaignId
    const campaign = getCampaine(campaignId);

    if (campaign) {
        const userId = await getUserId(ctx)
        const session = await memoryCache.get(`key-${campaignId}-${userId}`)
        if (session) {
            memoryCache.set(`key-${campaignId}-${userId}`, session, 1000 * 60 * 15)
            ctx.state.decryptedPrivateKey = session.privateKey
            ctx.state.campaign = campaign
            await next();
        } else {
            ctx.throw(404, 'Not authenticated!');
        }
    } else {
        ctx.throw(404, 'Campaign not found!');
    }
}


exports.routeManage = routeManage;