module.exports = async function(context) {

    const lock = await context.lock('shopify-plugin-init');

    let secret;
    try {
        secret = await context.service.stateGet('secret');
        if (!secret) {

            await require('./CustomerDataRequest')(context).createIndex({ status: 1 });
            await require('./CustomerRedactRequest')(context).createIndex({ status: 1 });
            await require('./ShopRedactRequest')(context).createIndex({ status: 1 });

            secret = require('crypto').randomBytes(128).toString('base64');
            await context.service.stateSet('secret', secret);
        }
    } finally {
        lock.unlock();
    }

    require('./routes')(context);
};
