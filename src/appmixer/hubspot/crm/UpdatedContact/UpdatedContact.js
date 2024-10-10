'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'contact.propertyChange';

class UpdatedContact extends BaseSubscriptionComponent {

    async getSubscriptions() {

        const properties = await this.getProperties();
        const subscriptions = [];
        const unsupported = ['lastmodifieddate'];

        // Subscribe to updates
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

        const { data } = await this.hubspot.call('get', 'crm/v3/properties/contacts');
        return data.results;
    };

    async receive(context) {

        this.configureHubspot(context);

        const eventsByObjectId = context.messages.webhook.content.data;

        let events = {};
        const validProperties = [
            'email',
            'firstname',
            'lastname',
            'phone',
            'website',
            'company',
            'address',
            'city',
            'state',
            'zip'
        ];

        for (const [contactId, event] of Object.entries(eventsByObjectId)) {
            // Only track changes in these properties. These are the ones present in the CreateContact inspector.
            // Even if we limit the subscriptions for these properties only, we need this for flows that
            // are already running and all the subscriptions.
            if (validProperties.includes(event.propertyName)) {
                events[contactId] = { occurredAt: event.occurredAt };
            }
        }

        // Get all objectIds
        const ids = Object.keys(events);

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        data.results.forEach((contact) => {
            // Don't send the contact if it was modified at the same time as it was created
            const eventOccurredAt = new Date(events[contact.id].occurredAt).getTime();
            const objectCreatedAt = new Date(contact.createdAt).getTime();
            if (eventOccurredAt > objectCreatedAt + 100) {
                delete data.results[contact.id];
            }
        });

        await context.sendArray(data.results, 'contact');

        return context.response();
    }
}

module.exports = new UpdatedContact(subscriptionType);
