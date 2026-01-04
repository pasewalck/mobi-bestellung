const Router = require("koa-router");

const { getItemsForcampaignId, getCampaigneById, insertOrder } = require('../util/db.js');
const { encryptWithPublicKey } = require("../util/crypt.js");
const { render } = require("../util/render.js");

function routePublic(app) {

    const router = new Router();

    router.get('/o/:campaignId', async (ctx) => {
        const campaignId = ctx.params.campaignId

        const items = getItemsForcampaignId(campaignId);
        await render(ctx, 'order', { items, campaignId });
    });

    router.post('/o/:campaignId', async (ctx) => {
        const campaignId = ctx.params.campaignId

        const items = getItemsForcampaignId(campaignId);
        const campaign = getCampaigneById(campaignId);

        const itemsInOrder = items.map(item => {
            const quantity = ctx.request.body[`quantities-${item.id}`] | 0;
            return {
                name: item.name,
                quantity: quantity
            };
        }).filter(order => order.quantity > 0);

        if (itemsInOrder.length <= 0) {
            ctx.throw(404, 'Order must include items');
            return;
        }

        const { email, whoIsOrdering, name, street, streetNumber, postalCode, city, country } = ctx.request.body;

        encryptedData = encryptWithPublicKey(campaign.publicKey, JSON.stringify({
            items: itemsInOrder, address: {
                name, street, streetNumber, postalCode, city, country
            }, details: {
                email, whoIsOrdering
            }
        }))

        insertOrder(campaign.id, encryptedData);

        await render(ctx, 'success', { orders: itemsInOrder, campaignId });
    });

    app.use(router.routes()).use(router.allowedMethods());
}

exports.routePublic = routePublic;
