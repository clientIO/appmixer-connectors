'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'contact.creation';

class NewContact extends BaseSubscriptionComponent {

    async getSubscriptions() {

        return [{
            enabled: true,
            subscriptionDetails: {
                subscriptionType: this.subscriptionType
            }
        }];
    }

    async receive(context) {

        const eventsByObjectId = context.messages.webhook.content.data;

        this.configureHubspot(context);
        // eslint-disable-next-line no-unused-vars
        for (const [contactId, event] of Object.entries(eventsByObjectId)) {
            try {
                const { data } = await this.hubspot.call(
                    'get',
                    `crm/v3/objects/contacts/${contactId}`
                );
                await context.sendJson(data, 'contact');
            } catch (error) {
                // ignore 404 errors, object could be deleted.
                if ((error.status || (error.response && error.response.status)) !== 404) {
                    throw error;
                }
            }
        }

        return context.response();
    }
}

module.exports = new NewContact(subscriptionType);
