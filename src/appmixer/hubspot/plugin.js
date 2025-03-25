'use strict';
const Hubspot = require('./Hubspot');

module.exports = async context => {

    const config = require('./config')(context);
    const { appId, apiKey } = config;
    const { clientId, clientSecret } = context.config;

    /** Is this AuthHub or Engine pod? */
    const isAuthHubPod = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;

    // When using AuthHub, the configuration is not needed in the Engine.
    // How do we know if we are using AuthHub? We have `clientId` but not `clientSecret` and no `appId` or `apiKey`.
    const isAuthHubInUse = !appId && !apiKey && !!clientId && !clientSecret;
    if (!(appId && apiKey) && !isAuthHubInUse && !isAuthHubPod) {
        context.log('error', 'HubSpot module not configured properly, missing appId or apiKey.');
        return {};
    }

    // Register webhook only in Engine pod and if not using AuthHub.
    if (!isAuthHubPod && !isAuthHubInUse) {
        const baseUrl = context.appmixerApiUrl;
        const eventsUrl = context.http.router.getPluginEndpoint('/events');
        const url = baseUrl.concat(eventsUrl);
        const hs = new Hubspot('', config);
        await hs.registerWebhook(url);
        context.hubspot = hs;
    } else {
        context.log('info', 'Auth hub detected, no need to register HubSpot webhook.');
    }

    require('./routes')(context);
};
