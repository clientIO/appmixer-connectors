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

        // Get all objectIds
        const ids = Object.keys(eventsByObjectId);

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        await context.sendArray(data.results, 'contact');

        return context.response();
    }
}

module.exports = new NewContact(subscriptionType);
