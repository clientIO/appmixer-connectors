'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');
const { WATCHED_PROPERTIES_CONTACT } = require('../../commons');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

    getSubscriptions() {

        const subscriptions = WATCHED_PROPERTIES_CONTACT.forEach((propertyName) => ({
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

        for (const [dealId, event] of Object.entries(eventsByObjectId)) {
            // Only track changes in these properties. These are the ones present in the CreateDeal inspector.
            // Even if we limit the subscriptions for these properties only, we need this for flows that
            // are already running and all the subscriptions.
            if (WATCHED_PROPERTIES_CONTACT.includes(event.propertyName)) {
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
