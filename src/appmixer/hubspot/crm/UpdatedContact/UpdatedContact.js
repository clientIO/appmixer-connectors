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

        if (context.messages.timeout) {
            const { contactId, occurredAt } = context.messages.timeout.content;
            await context.stateUnset(`contact-${contactId}`);

            try {
                const { data } = await this.hubspot.call('get', `crm/v3/objects/contacts/${contactId}`);
                if (occurredAt > new Date(data.createdAt).getTime() + 100) {
                    await context.sendJson(data, 'contact');
                }
            } catch (error) {
                // ignore 404 errors, object could be deleted.
                if ((error.status || (error.response && error.response.status)) !== 404) {
                    throw error;
                }
            }
            return;
        }

        if (context.messages.webhook) {
            const eventsByObjectId = context.messages.webhook.content.data;

            let timeouts = {};

            // eslint-disable-next-line no-unused-vars
            for (const [contactId, event] of Object.entries(eventsByObjectId)) {
                // Only track changes in these properties. These are the ones present in the CreateContact
                // inspector.
                // Even if we limit the subscriptions for these properties only, we need this for flows that
                // are already running and all the subscriptions.
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

                if (validProperties.includes(event.propertyName)) {
                    timeouts[contactId] = { occurredAt: event.occurredAt };
                }
            }

            for (const [contactId, event] of Object.entries(timeouts)) {

                let lock;
                try {
                    lock = await context.lock(`UpdatedContact-${contactId}`);

                    const previousTimeout = await context.stateGet(`contact-${contactId}`);
                    let occurrenceTime = event.occurredAt;
                    if (previousTimeout) {
                        await context.clearTimeout(previousTimeout.timeoutId);
                        occurrenceTime = event.occurredAt > previousTimeout.occurredAt
                            ? event.occurredAt
                            : previousTimeout.occurredAt;
                    }

                    const timeoutId = await context.setTimeout(
                        { contactId, occurredAt: occurrenceTime }, context.config.triggerTimeout || 5000);
                    await context.stateSet(`contact-${contactId}`, { timeoutId, occurredAt: occurrenceTime });
                } finally {
                    if (lock) {
                        lock.unlock();
                    }
                }
            }

            return context.response();
        }
    }
}

module.exports = new UpdatedContact(subscriptionType);
