'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

    async getSubscriptions() {

        const properties = await this.getProperties();
        const subscriptions = [];
        const unsupported = ['hs_lastmodifieddate'];
        properties.forEach((property) => {
            if (
                !property.hidden &&
                !property.deleted &&
                !property.readOnlyValue &&
                !unsupported.includes(property.name)
            ) {
                subscriptions.push({
                    enabled: true,
                    subscriptionDetails: {
                        subscriptionType: this.subscriptionType,
                        propertyName: property.name
                    }
                });
            }
        });
        return subscriptions;
    }

    async getProperties() {

        const { data } = await this.hubspot.call('get', 'crm/v3/properties/deals');
        return data.results;
    };

    async receive(context) {

        this.configureHubspot(context);

        const eventsByObjectId = context.messages.webhook.content.data;

        let events = {};
        const validProperties = [
            'dealname',
            'dealstage',
            'pipeline',
            'hubSpotOwnerId',
            'closedate',
            'amount'
        ];

        for (const [dealId, event] of Object.entries(eventsByObjectId)) {
            // Only track changes in these properties. These are the ones present in the CreateDeal inspector.
            // Even if we limit the subscriptions for these properties only, we need this for flows that
            // are already running and all the subscriptions.
            if (validProperties.includes(event.propertyName)) {
                events[dealId] = { occurredAt: event.occurredAt };
            }
        }

        // Get all objectIds
        const ids = Object.keys(events);

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/deals/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        data.results.forEach((deal) => {
            // Don't send the contact if it was modified at the same time as it was created
            const eventOccurredAt = new Date(events[deal.id].occurredAt).getTime();
            const objectCreatedAt = new Date(deal.createdAt).getTime();
            if (eventOccurredAt > objectCreatedAt + 100) {
                delete data.results[deal.id];
            }
        });

        await context.sendArray(data.results, 'deal');

        return context.response();
    }
}

module.exports = new UpdatedDeal(subscriptionType);
