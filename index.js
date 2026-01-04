const Koa = require('koa');
const serve = require('koa-static');
const { koaBody } = require('koa-body');
const path = require('path');
require('dotenv').config()

const { routePublic } = require('./routes/public.js');
const { routeManage } = require('./routes/manage.js');

const app = new Koa();

app.use(koaBody({
    multipart: true,
    formidable: {
        allowEmptyFiles: true,
        minFileSize: 0,
        maxFileSize: 200 * 1024 * 1024,
    },
}));

app.use(serve(path.join(__dirname, 'styles', 'dist')));
app.use(serve(path.join(__dirname, 'public')));

routeManage(app)
routePublic(app)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on Port: ${PORT}`);
});
