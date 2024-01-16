'use strict';
const Promise = require('bluebird');
const _ = require('lodash');

const getSubscriptionEntries = async (context, subscriptionType) => {

    return (await context.service.stateGet(subscriptionType)) || [];
};

module.exports = async (context) => {

    context.http.router.register({
        method: 'POST',
        path: '/subscribe/{subscriptionType}',
        options: {
            auth: false,
            handler: async (req) => {

                const { subscriptionType } = req.params;

                try {
                    const lock = await context.lock(subscriptionType);

                    try {
                        const subscriptions = req.payload;
                        if (!Array.isArray(subscriptions) || !subscriptions.length) {
                            return {};
                        }

                        const response = await context.hubspot.getAllSubscriptions();
                        const currentSubs = response.data.results.map(s => s.eventType);

                        let subscriptionsToCreate = [];
                        subscriptions.forEach(s => {
                            if (!currentSubs.includes(s.subscriptionDetails.subscriptionType)) {
                                subscriptionsToCreate.push(s);
                            }
                        });

                        if (!subscriptionsToCreate.length) {
                            return {};
                        }

                        const { data } = await context.hubspot.createSubscriptions(subscriptions);
                        return data;

                    } finally {
                        await lock.unlock();
                    }

                } catch (err) {
                    if (err.message !== 'locked') {
                        throw err;
                    }
                }

                return {};
            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/subscribe/{subscriptionType}',
        options: {
            auth: false,
            handler: async (req) => {

                const { subscriptionType } = req.params;

                try {
                    const lock = await context.lock(subscriptionType);

                    try {
                        const flows = await getSubscriptionEntries(context, subscriptionType);
                        if (flows.length > 1) {
                            // do not delete subscriptions if there are multiple receivers.
                            return {};
                        }

                        const subscriptionIds = [];
                        const { data } = await context.hubspot.getAllSubscriptions();
                        (data.results || [])
                            .forEach(subscription => {
                                if (subscription.eventType === subscriptionType) {
                                    subscriptionIds.push(subscription.id);
                                }
                            });

                        if (subscriptionIds.length) {
                            for (const ids of _.chunk(subscriptionIds, 30)) {
                                await context.hubspot.deleteSubscriptions(ids);
                            }
                        }
                        return true;

                    } finally {
                        await lock.unlock();
                    }

                } catch (err) {
                    if (err.message !== 'locked') {
                        throw err;
                    }
                }

                return {};
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req) => {

                const events = Array.isArray(req.payload) ? req.payload : [req.payload];
                if (!Array.isArray(events) || !events.length) {
                    return {};
                }

                const eventsBySubscriptionType = _.groupBy(events, 'subscriptionType');

                for (const [subscriptionType, subscriptionEvents] of Object.entries(eventsBySubscriptionType)) {
                    const eventsByObjectId = _.keyBy(subscriptionEvents, 'objectId');
                    const registeredComponents = await context.service.stateGet(subscriptionType);
                    // we cannot wait for the results, 200 response has to be sent within 5
                    // seconds, otherwise they're gonna send retries
                    Promise.map(registeredComponents, registered => {
                        return Promise.resolve(context.triggerComponent(
                            registered.flowId,
                            registered.componentId,
                            eventsByObjectId,
                            {},
                            {}
                        )).reflect();
                    }, { concurrency: 100 }).each(inspection => {
                        if (!inspection.isFulfilled()) {
                            context.log('error', inspection.reason());
                        }
                    }).catch(err => {
                        context.log('error', err.message, err);
                    });
                }

                return {};
            }
        }
    });
};
