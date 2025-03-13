'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'deal.creation';

class NewDeal extends BaseSubscriptionComponent {

    getSubscriptions() {

        return [{
            enabled: true,
            subscriptionDetails: {
                subscriptionType: this.subscriptionType
            }
        }];
    }

    async receive(context) {

        this.configureHubspot(context);

        const eventsByObjectId = context.messages.webhook.content.data;

        // Get all objectIds that will be used to fetch the contacts in bulk
        let ids = [];
        // Locking to avoid duplicates. HubSpot payloads can come within milliseconds of each other.
        let lock;

        try {
            lock = await context.lock(context.componentId, {
                ttl: 1000 * 10,
                retryDelay: 500,
                maxRetryCount: 3
            });

            for (const [dealId] of Object.entries(eventsByObjectId)) {
                const cacheKey = 'hubspot-deal-created-' + dealId;
                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    continue;
                }
                // Cache the event for 5s to avoid duplicates
                await context.staticCache.set(cacheKey, dealId, context.config?.eventCacheTTL || 5000);
                ids.push(dealId);
            }
        } finally {
            await lock?.unlock();
        }

        if (!ids.length) {
            // No new contacts to fetch
            return context.response();
        }

        let propertiesToReturn;
        const { properties } = context.properties;
        if (!properties) {
            // Return all properties by default.
            const { data } = await this.hubspot.call('get', 'crm/v3/properties/deals');
            propertiesToReturn = data.results?.map((property) => property.name);
        } else {
            propertiesToReturn = properties.split(',');
        }

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/deals/batch/read', {
            inputs: ids.map((id) => ({ id })),
            properties: propertiesToReturn
        });

        await context.sendArray(data.results, 'deal');

        return context.response();
    }
}

module.exports = new NewDeal(subscriptionType);
