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

        // Get all contactIds
        const contactIds = Object.keys(eventsByObjectId);

        // Call the API to get the contacts in bulk
        const { data: contacts } = await this.hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: contactIds.map((contactId) => ({ id: contactId }))
        });

        await context.sendArray(contacts.results, 'contact');

        return context.response();
    }
}

module.exports = new NewContact(subscriptionType);
