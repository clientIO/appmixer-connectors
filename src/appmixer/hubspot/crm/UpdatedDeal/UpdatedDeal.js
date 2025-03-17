'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');
const { WATCHED_PROPERTIES_DEAL } = require('../../commons');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

    getSubscriptions() {

        const subscriptions = WATCHED_PROPERTIES_DEAL.map((propertyName) => ({
            enabled: true,
            subscriptionDetails: {
                subscriptionType,
                propertyName
            }
        }));
        return subscriptions;
    }

    async receive(context) {

        this.configureHubspot(context);

        const eventsByObjectId = context.messages.webhook.content.data;

        let events = {};
        // Locking to avoid duplicates. HubSpot payloads can come within milliseconds of each other.
        let lock;
        try {
            lock = await context.lock(context.componentId, {
                ttl: 1000 * 10,
                retryDelay: 500,
                maxRetryCount: 3
            });

            for (const [dealId, event] of Object.entries(eventsByObjectId)) {
                const cacheKey = 'hubspot-deal-updated-' + dealId;
                // Only track changes in these properties. These are the ones present in the CreateDeal inspector.
                // Even if we limit the subscriptions for these properties only, we need this for flows that
                // are already running and all the subscriptions.
                if (WATCHED_PROPERTIES_DEAL.includes(event.propertyName)) {
                    const cached = await context.staticCache.get(cacheKey);
                    if (cached && event.occurredAt <= cached) {
                        continue;
                    }
                    // Cache the event for 5s to avoid duplicates
                    await context.staticCache.set(cacheKey, event.occurredAt, context.config?.eventCacheTTL || 5000);
                    events[dealId] = { occurredAt: event.occurredAt };
                }
            }
        } finally {
            await lock?.unlock();
        }

        // Get all objectIds
        const ids = Object.keys(events);
        if (!ids.length) {
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

        const results = [];
        data.results.forEach((deal) => {
            if (deal.updatedAt !== deal.createdAt) {
                results.push(deal);
            }
        });

        await context.sendArray(results, 'deal');

        return context.response();
    }
}

module.exports = new UpdatedDeal(subscriptionType);
