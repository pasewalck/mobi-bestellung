const ejs = require('ejs');
const path = require('path');

async function render(ctx, renderPath, data = {}) {
    renderPath = path.join("views", renderPath.endsWith(".ejs") ? renderPath : `${renderPath}.ejs`);
    try {
        ctx.body = await ejs.renderFile(renderPath, data);
    } catch (error) {
        console.log(`Error rendering template at ${renderPath} with error:`, error);
    }
}
exports.render = render;
