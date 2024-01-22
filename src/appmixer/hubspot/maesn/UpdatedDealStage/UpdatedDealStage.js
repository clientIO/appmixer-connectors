'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

    async getSubscriptions() {

        const subscriptions = [];
        subscriptions.push({
            enabled: true,
            subscriptionDetails: {
                subscriptionType: this.subscriptionType,
                propertyName: 'dealstage'
            }
        });
        return subscriptions;
    }

    async receive(context) {
        this.configureHubspot(context);

        if (context.messages.webhook) {

            const eventsByObjectId = context.messages.webhook.content.data;
            const validProperties = ['dealstage'];

            for (const [dealId, event] of Object.entries(eventsByObjectId)) {

                let lock;

                if (validProperties.includes(event.propertyName)) {

                    try {
                        lock = await context.lock(`UpdatedDeal-${dealId}`);
                        const { data } = await this.hubspot.call('get', `crm/v3/objects/deals/${dealId}`);
                        if (event.occurredAt > new Date(data.createdAt).getTime() + 1000) {

                            const eventIdentifier = `${data.id}` + `${data.properties.hs_lastmodifieddate}` + `${data.properties.dealstage}`;

                            let eventProcessed = await context.stateGet(eventIdentifier);
                            eventProcessed = eventProcessed !== undefined ? eventProcessed : false;
                            if (!eventProcessed) {

                                await context.stateSet(eventIdentifier, true);
                                await context.sendJson(data, 'deal');
                            } else {}

                        }
                    } catch (error) {
                        if ((error.status || (error.response && error.response.status)) !== 404) {
                            throw error;
                        }
                    } finally {
                        if (lock) {
                            lock.unlock();
                        }

                    }
                }
            }

            return context.response();
        }
    }
}

module.exports = new UpdatedDeal(subscriptionType);







