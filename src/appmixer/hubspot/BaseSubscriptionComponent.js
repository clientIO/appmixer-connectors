'use strict';

const Hubspot = require('./Hubspot');

class BaseSubscriptionComponent {

    constructor(subscriptionType, options = {}) {

        this.subscriptionType = subscriptionType;
        this.hubspot = new Hubspot('', options);
    }

    configureHubspot(context) {

        const { config, auth } = context;
        this.hubspot.setApiKey(config.apiKey);
        this.hubspot.setAppId(config.appId);
        this.hubspot.setToken(auth.accessToken);
    }

    getSubscriptions(context) {

        throw new Error('Must be extended to return subscriptions');
    }

    async receive(context) {

        throw new Error('Must be extended');
    }

    async start(context) {

        this.configureHubspot(context);
        // Use hub_id from context to differentiate between different HubSpot portals/users.
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.addListener(`${this.subscriptionType}:${portalId}`, { apiKey: context.config.apiKey, appId: context.config.appId });
    }

    async stop(context) {

        this.configureHubspot(context);
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.removeListener(`${this.subscriptionType}:${portalId}`);
    }
}

module.exports = BaseSubscriptionComponent;
