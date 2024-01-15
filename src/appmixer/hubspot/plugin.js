'use strict';
const Hubspot = require('./Hubspot');

module.exports = async context => {

    const config = require('./config')(context);

    if (!(config.appId && config.apiKey)) {
        context.log('error', 'Hubspot module not configured properly, missing appId or apiKey.');
        return {};
    }
    const baseUrl = context.appmixerApiUrl;
    const eventsUrl = context.http.router.getPluginEndpoint('/events');
    const url = baseUrl.concat(eventsUrl);
    const hs = new Hubspot('', config);
    await hs.registerWebhook(url);

    context.hubspot = hs;
    require('./routes')(context);
};
