'use strict';

module.exports = async context => {

    const config = require('./config')(context);

    const isAuthHub = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
    if (!(config.appId && config.apiKey) && !isAuthHub) {
        context.log('error', 'Hubspot module not configured properly, missing appId or apiKey.');
        return {};
    }

    require('./routes')(context);
};
