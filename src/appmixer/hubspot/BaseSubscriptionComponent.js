'use strict';
const axios = require('axios');
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
        await this.subscribe(context);
        // Use hub_id from context to differentiate between different HubSpot portals/users.
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.service.stateAddToSet(`${this.subscriptionType}:${portalId}`,{
            componentId: context.componentId,
            flowId: context.flowId
        });
    }

    async stop(context) {

        this.configureHubspot(context);
        await this.deleteSubscriptions(context);
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.service.stateRemoveFromSet(`${this.subscriptionType}:${portalId}`,{
            componentId: context.componentId,
            flowId: context.flowId
        });
    }

    async subscribe(context) {

        const subscriptions = this.getSubscriptions(context);
        const { appmixerApiUrl } = context;
        const endpoint = `/plugins/appmixer/hubspot/subscribe/${this.subscriptionType}`;
        const url = appmixerApiUrl.concat(endpoint);
        return axios.post(url, subscriptions);
    };

    async deleteSubscriptions(context) {

        const { appmixerApiUrl } = context;
        const endpoint = `/plugins/appmixer/hubspot/subscribe/${this.subscriptionType}`;
        const url = appmixerApiUrl.concat(endpoint);
        return axios.delete(url);
    };
}

module.exports = BaseSubscriptionComponent;
