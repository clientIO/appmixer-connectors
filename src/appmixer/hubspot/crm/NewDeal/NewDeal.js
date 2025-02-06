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

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/deals/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        await context.sendArray(data.results, 'deal');

        return context.response();
    }
}

module.exports = new NewDeal(subscriptionType);
