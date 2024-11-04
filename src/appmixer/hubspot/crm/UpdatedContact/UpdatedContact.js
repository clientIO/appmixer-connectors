'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');
const { WATCHED_PROPERTIES_CONTACT } = require('../../commons');

const subscriptionType = 'contact.propertyChange';

class UpdatedContact extends BaseSubscriptionComponent {

    getSubscriptions() {

        // Only watching for the properties that are present in the CreateContact inspector.
        const subscriptions = WATCHED_PROPERTIES_CONTACT.map(propertyName => ({
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

        for (const [contactId, event] of Object.entries(eventsByObjectId)) {
            // Only track changes in these properties. These are the ones present in the CreateContact inspector.
            // Even if we limit the subscriptions for these properties only, we need this for flows that
            // are already running and all the subscriptions.
            if (WATCHED_PROPERTIES_CONTACT.includes(event.propertyName)) {
                events[contactId] = { occurredAt: event.occurredAt };
            }
        }

        // Get all objectIds
        const ids = Object.keys(events);

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        const results = [];
        data.results.forEach((contact) => {
            // Don't send the contact if it was modified at the same time as it was created
            const eventOccurredAt = new Date(contact.updatedAt).getTime();
            const objectCreatedAt = new Date(contact.createdAt).getTime();
            if (eventOccurredAt > (objectCreatedAt + 100)) {
                results.push(contact);
            }
        });

        await context.sendArray(results, 'contact');

        return context.response();
    }
}

module.exports = new UpdatedContact(subscriptionType);
