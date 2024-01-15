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


        if (context.messages.webhook) {

            const eventsByObjectId = context.messages.webhook.content.data;

            for (const [dealId] of Object.entries(eventsByObjectId)) {
                let lock;
                try {
                    lock = await context.lock(`CreatedDeal-${dealId}`);

                    const previousTimeout = await context.stateGet(`deal-${dealId}`);
                    if (previousTimeout) {
                        await context.clearTimeout(previousTimeout.timeoutId);
                    }

                    const timeoutId = await context.setTimeout({ dealId }, context.config.triggerTimeout || 5000);
                    await context.stateSet(`deal-${dealId}`, { timeoutId });
                } finally {
                    if (lock) {
                        lock.unlock();
                    }
                }
            }

            return context.response();
        }

        if (context.messages.timeout) {
            const { dealId } = context.messages.timeout.content;
            await context.stateUnset(`deal-${dealId}`);

            try {
                const { data } = await this.hubspot.call('get', `crm/v3/objects/deals/${dealId}`);
                await context.sendJson(data, 'deal');
            } catch (error) {
                // ignore 404 errors, object could be deleted.
                if ((error.status || (error.response && error.response.status)) !== 404) {
                    throw error;
                }
            }
        }
    }
}

module.exports = new NewDeal(subscriptionType);
