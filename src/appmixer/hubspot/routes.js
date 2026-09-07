'use strict';

const _ = require('lodash');
const { WATCHED_PROPERTIES_CONTACT, WATCHED_PROPERTIES_DEAL } = require('./commons');

module.exports = async (context) => {

    // Called by Appmixer when a listener is added to the plugin (eg. UpdatedContact component is started) to subscribe to HubSpot events.
    // This will create a subscription in HubSpot for the given subscriptionType if it does not exist.
    context.onListenerAdded(async (listener) => {

        /** Is this AuthHub or Engine pod? */
        const isAuthHubPod = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
        if (isAuthHubPod) {
            // This is AuthHub, we don't need to create subscriptions here.
            return;
        }

        const { eventName, params } = listener;

        // Retry on lock contention. Each ContactPropertyChanged listener contributes a distinct
        // propertyName, so two listeners of the same subscriptionType starting concurrently must not
        // drop each other's subscription — wait for the lock instead of silently giving up.
        let lock;
        try {
            lock = await context.lock(eventName, {
                ttl: 1000 * 30,
                retryDelay: 500,
                maxRetryCount: 20
            });

            const subscriptionType = eventName.split(':')[0];
            const subscriptions = getSubscriptionsByType(subscriptionType, context, params);
            const results = await getHubSpotSubscriptions(context, params);

            // Reconcile on the full (eventType, propertyName) pair. HubSpot models each watched
            // property as its own subscription, so comparing eventType alone would treat every
            // propertyChange property as already-subscribed once any one of them exists.
            const subKey = (eventType, propertyName) => `${eventType}:${propertyName || ''}`;
            const existingByKey = new Map();
            results.forEach(r => existingByKey.set(subKey(r.eventType, r.propertyName), r));

            const subscriptionsToCreate = [];
            for (const sub of subscriptions) {
                const { subscriptionType: evType, propertyName } = sub.subscriptionDetails;
                const existing = existingByKey.get(subKey(evType, propertyName));
                if (!existing) {
                    subscriptionsToCreate.push(sub);
                } else if (!existing.enabled) {
                    // Re-enable a disabled subscription for this exact property — don't stop at the
                    // first one, every desired property must end up active.
                    await activateHubSpotSubscription(context, params, existing.id);
                }
            }

            if (subscriptionsToCreate.length) {
                const { data } = await createHubSpotSubscriptions(context, params, subscriptionsToCreate);
                return data;
            }

            return {};

        } catch (err) {
            context.log('error', 'hubspot-plugin-listener-added-error', { listener, error: err.message });
            throw err;
        } finally {
            await lock?.unlock();
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
                    // Pass all events through — no property allowlist filtering here.
                    // The false-trigger problem (creation also firing update) is handled downstream
                    // in triggerListenersDelayed(), which checks if the object was just created
                    // and skips propertyChange events that arrived within the same creation window.
                    // Filtering here would silently drop any property not in the hardcoded list
                    // (e.g. lifecyclestage, custom properties), breaking user-configured subscriptions.
                    const filteredEvents = [...subscriptionEvents];
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

    // If this is an update event, filter out per-objectId any objects that were just created.
    // HubSpot sends propertyChange events alongside a creation event for the same object —
    // we skip only those specific objects, not the entire payload.
    if (eventName.includes('.propertyChange:')) {
        const subscriptionType = eventName.split(':')[0];
        const subscriptionTypeCreated = subscriptionType.replace('.propertyChange', '.creation');
        const portalId = eventName.split(':')[1];

        const filteredPayload = {};
        for (const [objectId, event] of Object.entries(payload)) {
            // Looking for the created timestamp in the database for the same object.
            const createdTimestamp = await context.service.stateGet(`${portalId}:${subscriptionTypeCreated}:${objectId}`);
            if (createdTimestamp && event.occurredAt <= createdTimestamp) {
                // This propertyChange arrived with a creation event — skip this object only.
                continue;
            }
            filteredPayload[objectId] = event;
        }

        if (!Object.keys(filteredPayload).length) {
            return;
        }

        await context.triggerListeners({ eventName, payload: filteredPayload });
        return;
    }

    await context.triggerListeners({ eventName, payload });
}

function getSubscriptionsByType(subscriptionType, context, params = {}) {

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
        // Start with the default watched properties.
        const propertySet = new Set(WATCHED_PROPERTIES_CONTACT);
        // If a specific property was requested (e.g. by ContactPropertyChanged), ensure it is included.
        if (params.propertyName) {
            propertySet.add(params.propertyName);
        }
        subscriptions = Array.from(propertySet).map(propertyName => ({
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

async function activateHubSpotSubscription(context, hubspot, subscriptionId) {

    const result = await context.httpRequest({
        method: 'PATCH',
        url: `https://api.hubapi.com/webhooks/v3/${hubspot.appId}/subscriptions/${subscriptionId}?hapikey=${hubspot.apiKey}`,
        data: { enabled: true }
    });

    if (result.data?.ok === false) {
        throw new Error(response?.data?.error);
    }

    return result;
}
