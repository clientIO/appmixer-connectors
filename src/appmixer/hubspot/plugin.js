'use strict';

module.exports = async context => {

    const config = require('./config')(context);

    if (!(config.appId && config.apiKey)) {
        context.log('error', 'Hubspot module not configured properly, missing appId or apiKey.');
        return {};
    }

    require('./routes')(context);
};
