'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');
const { getObjectProperties } = require('../../commons');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

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
                const cached = await context.staticCache.get(cacheKey);
                if (cached && event.occurredAt <= cached) {
                    continue;
                }
                // Cache the event for 5s to avoid duplicates
                await context.staticCache.set(cacheKey, event.occurredAt, context.config?.eventCacheTTL || 5000);
                events[dealId] = { occurredAt: event.occurredAt };
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
            propertiesToReturn = await getObjectProperties(context, this.hubspot, 'deals', 'names');
        } else {
            propertiesToReturn = properties.split(',');
        }

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/deals/batch/read', {
            inputs: ids.map((id) => ({ id })),
            properties: propertiesToReturn
        });

        const { pipeline: filterPipeline, dealstage: filterStage } = context.properties;

        const results = [];
        data.results.forEach((deal) => {
            if (deal.updatedAt !== deal.createdAt) {
                // Filter by pipeline if configured
                if (filterPipeline && deal.properties?.pipeline !== filterPipeline) {
                    return;
                }
                // Filter by deal stage if configured
                if (filterStage && deal.properties?.dealstage !== filterStage) {
                    return;
                }
                results.push(deal);
            }
        });

        await context.sendArray(results, 'deal');

        return context.response();
    }

    async test(context) {

        const { pipeline: filterPipeline, dealstage: filterStage } = context.properties;
        const filters = [];
        if (filterPipeline) {
            filters.push({ propertyName: 'pipeline', operator: 'EQ', value: filterPipeline });
        }
        if (filterStage) {
            filters.push({ propertyName: 'dealstage', operator: 'EQ', value: filterStage });
        }
        const record = await this.fetchLatestExample(context, 'deals', { sortProperty: 'lastmodifieddate', filters });
        return context.sendJson(record, 'deal');
    }
}

module.exports = new UpdatedDeal(subscriptionType);
