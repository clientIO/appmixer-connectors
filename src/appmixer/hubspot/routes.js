'use strict';

const _ = require('lodash');
const { WATCHED_PROPERTIES_CONTACT, WATCHED_PROPERTIES_DEAL } = require('./commons');

module.exports = async (context) => {

    // Called by Appmixer when a listener is added to the plugin (eg. UpdatedContact component is started) to subscribe to HubSpot events.
    // This will create a subscription in HubSpot for the given subscriptionType if it does not exist.
    context.onListenerAdded(async (listener) => {

        const isAuthHub = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
        if (isAuthHub) {
            // This is AuthHub, we don't need to create subscriptions here.
            return;
        }

        const { eventName, params } = listener;

        try {
            const lock = await context.lock(eventName);

            try {
                const subscriptionType = eventName.split(':')[0];
                const subscriptions = getSubscriptionsByType(subscriptionType, context);
                const results = await getHubSpotSubscriptions(context, params);
                const currentSubs = results.map(s => s.eventType);

                let subscriptionsToCreate = [];
                subscriptions.forEach(s => {
                    if (!currentSubs.includes(s.subscriptionDetails.subscriptionType)) {
                        subscriptionsToCreate.push(s);
                    }
                });

                if (!subscriptionsToCreate.length) {
                    return {};
                }

                const { data } = await createHubSpotSubscriptions(context, params, subscriptionsToCreate);
                return data;

            } catch (err) {
                context.log('error', 'hubspot-plugin-listener-added-error', { listener, error: err.message });
                throw err;
            } finally {
                await lock.unlock();
            }
        } catch (err) {
            if (err.message !== 'locked') {
                throw err;
            }
        }
    });

    // Called by HubSpot when an event occurs. Can be in AuthHub or in standalone Appmixer instance.
    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req) => {

                await context.log('info', 'hubspot-plugin-route-webhook-hit', { eventCount: req.payload?.length });
                context.log('trace', 'hubspot-plugin-route-webhook-payload', { payload: req.payload });
                if (!req.payload || typeof req.payload !== 'object') {
                    context.log('warn', 'hubspot-plugin-route-webhook-missing-payload');
                    return {};
                }
                const events = Array.isArray(req.payload) ? req.payload : [req.payload];
                if (!Array.isArray(events) || !events.length) {
                    return {};
                }

                let eventCount = 0;

                // Portal ID (hub_id) is the same for all events.
                const portalId = events[0].portalId;
                const eventsBySubscriptionType = _.groupBy(events, 'subscriptionType');

                // Note on batching: The batch size can vary, but will be under 100 notifications.
                // See: https://legacydocs.hubspot.com/docs/methods/webhooks/webhooks-overview
                for (const [subscriptionType, subscriptionEvents] of Object.entries(eventsBySubscriptionType)) {
                    // Skipping propertyChange events for properties that are not watched.
                    const filteredEvents = [];
                    if (subscriptionType.endsWith('propertyChange')) {
                        let watchedProperties = [];
                        if (subscriptionType === 'deal.propertyChange') {
                            watchedProperties = WATCHED_PROPERTIES_DEAL;
                        } else if (subscriptionType === 'contact.propertyChange') {
                            watchedProperties = WATCHED_PROPERTIES_CONTACT;
                        } else {
                            throw new Error(`Unsupported subscriptionType: ${subscriptionType}`);
                        }

                        subscriptionEvents.forEach(event => {
                            if (watchedProperties.includes(event.propertyName)) {
                                filteredEvents.push(event);
                            }
                        });
                    } else {
                        // For creation events, we don't need to filter.
                        filteredEvents.push(...subscriptionEvents);
                    }
                    const eventsByObjectId = _.keyBy(filteredEvents, 'objectId');
                    const objectIds = Object.keys(eventsByObjectId);
                    if (!objectIds.length) {
                        continue;
                    }

                    // Here instead of directly triggering the listeners, we store the events in the MongoDB database.
                    // Store only `create` events in MongoDB
                    if (subscriptionType.endsWith('creation')) {
                        // Await all promises
                        const storePromises = objectIds.map(async objectId => {
                            const event = eventsByObjectId[objectId];
                            // Store in MongoDB
                            return context.service.stateSet(`${portalId}:${subscriptionType}:${objectId}`, event.occurredAt);
                        });
                        await Promise.all(storePromises);
                    }

                    // Trigger listeners in 5 seconds
                    setTimeout(async function() {
                        await triggerListenersDelayed(context, `${subscriptionType}:${portalId}`, eventsByObjectId);
                    }, context.config?.webhookTriggerDelayMs || 5000);

                    // Clear the cache in 10 seconds, after the listeners are triggered
                    setTimeout(async () => {
                        const deletePromises = objectIds.map(async objectId => {
                            return context.service.stateUnset(`${portalId}:${subscriptionType}:${objectId}`);
                        });
                        await Promise.all(deletePromises);
                    }, context.config?.webhookCacheClearMs || 10000);

                    eventCount += filteredEvents.length;
                }

                context.log('info', 'hubspot-plugin-route-webhook-success', { eventCount });
                return {};
            }
        }
    });
};

// Trigger listeners after 5 seconds. This is to avoid duplicate events.
// See https://github.com/clientIO/appmixer-components/issues/1700#issuecomment-2605687394
async function triggerListenersDelayed(context, eventName, payload) {

    // If this is an update event, check if the object was created in the last 5 seconds
    // If it was, skip the update event
    if (eventName.includes('.propertyChange:')) {
        const objectId = Object.keys(payload)[0];
        const subscriptionType = eventName.split(':')[0];
        const subscriptionTypeCreated = subscriptionType.replace('.propertyChange', '.creation');
        const portalId = eventName.split(':')[1];
        // Looking for the created timestamp in the database for the same object.
        const createdTimestamp = await context.service.stateGet(`${portalId}:${subscriptionTypeCreated}:${objectId}`);
        if (createdTimestamp && payload[objectId].occurredAt <= createdTimestamp) {
            // This is an update event for an object that was created in the last 5 seconds.
            return;
        }
    }

    await context.triggerListeners({ eventName, payload });
}

function getSubscriptionsByType(subscriptionType, context) {

    let subscriptions = [];

    if (subscriptionType === 'deal.propertyChange') {
        subscriptions = WATCHED_PROPERTIES_DEAL.map(propertyName => ({
            enabled: true,
            subscriptionDetails: {
                subscriptionType,
                propertyName
            }
        }));
    } else if (subscriptionType === 'contact.propertyChange') {
        subscriptions = WATCHED_PROPERTIES_CONTACT.map(propertyName => ({
            enabled: true,
            subscriptionDetails: {
                subscriptionType,
                propertyName
            }
        }));
    } else if (subscriptionType === 'contact.creation' || subscriptionType === 'deal.creation') {
        subscriptions = [{
            enabled: true,
            subscriptionDetails: { subscriptionType }
        }];
    } else if (subscriptionType === 'contact.deletion') {
        subscriptions = [{
            enabled: true,
            subscriptionDetails: { subscriptionType }
        }];
    } else {
        context.log('error', 'hubspot-plugin-listener-added-unsupported-subscription-type', { subscriptionType });
        return;
    }

    return subscriptions;
}

async function getHubSpotSubscriptions(context, hubspot) {

    const { data } = await context.httpRequest({
        method: 'GET',
        url: `https://api.hubapi.com/webhooks/v3/${hubspot.appId}/subscriptions?hapikey=${hubspot.apiKey}`
    });

    if (data?.ok === false) {
        throw new Error(response?.data?.error);
    }

    return data.results;
}

async function createHubSpotSubscriptions(context, hubspot, subscriptions) {

    const result = await context.httpRequest({
        method: 'POST',
        url: `https://api.hubapi.com/webhooks/v1/${hubspot.appId}/subscriptions/batch?hapikey=${hubspot.apiKey}`,
        data: subscriptions
    });

    if (result.data?.ok === false) {
        throw new Error(response?.data?.error);
    }

    return result;
}
