'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'deal.creation';

class NewDeal extends BaseSubscriptionComponent {

    async getSubscriptions() {

        return [{
            enabled: true,
            subscriptionDetails: {
                subscriptionType: this.subscriptionType
            }
        }];
    }

    async receive(context) {

        this.configureHubspot(context);

        const eventsByObjectId = context.messages.webhook.content.data;;

        // Get all objectIds
        const ids = Object.keys(eventsByObjectId);

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/deals/batch/read', {
            inputs: ids.map((id) => ({ id }))
        });

        await context.sendArray(data.results, 'deal');

        return context.response();
    }
}

module.exports = new NewDeal(subscriptionType);
