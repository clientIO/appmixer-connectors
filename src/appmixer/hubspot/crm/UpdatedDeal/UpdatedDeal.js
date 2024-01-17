'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'deal.propertyChange';

class UpdatedDeal extends BaseSubscriptionComponent {

    async getSubscriptions() {

        const properties = await this.getProperties();
        const subscriptions = [];
        const unsupported = ['hs_lastmodifieddate'];
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

        const { data } = await this.hubspot.call('get', 'crm/v3/properties/deals');
        return data.results;
    };

    async receive(context) {

        this.configureHubspot(context);

        if (context.messages.timeout) {

            const { dealId, occurredAt } = context.messages.timeout.content;
            await context.stateUnset(`deal-${dealId}`);

            try {
                const { data } = await this.hubspot.call('get', `crm/v3/objects/deals/${dealId}`);
                if (occurredAt > new Date(data.createdAt).getTime() + 1000) {
                    await context.sendJson(data, 'deal');
                }
            } catch (error) {
                // ignore 404 errors, object could be deleted.
                if ((error.status || (error.response && error.response.status)) !== 404) {
                    throw error;
                }
            }
        }

        if (context.messages.webhook) {
            const eventsByObjectId = context.messages.webhook.content.data;
            let timeouts = {};


            // eslint-disable-next-line no-unused-vars
            for (const [dealId, event] of Object.entries(eventsByObjectId)) {
                const validProperties = [
                    'dealname',
                    'dealstage',
                    'pipeline',
                    'hubSpotOwnerId',
                    'closedate',
                    'amount'
                ];

                if (validProperties.includes(event.propertyName)) {
                    timeouts[dealId] = { occurredAt: event.occurredAt };
                }
            }

            // We are basically debouncing the update event, because Hubspot can send a webhook for
            // each property that was updated.
            for (const [dealId, event] of Object.entries(timeouts)) {
                let lock;
                try {
                    lock = await context.lock(`UpdatedDeal-${dealId}`);

                    const previousTimeout = await context.stateGet(`deal-${dealId}`);
                    let occurrenceTime = event.occurredAt;
                    if (previousTimeout) {
                        await context.clearTimeout(previousTimeout.timeoutId);
                    }

                    const timeoutId = await context.setTimeout(
                        { dealId, occurredAt: occurrenceTime },
                        context.config.triggerTimeout || 5000
                    );
                    await context.stateSet(`deal-${dealId}`, { timeoutId });
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

module.exports = new UpdatedDeal(subscriptionType);
