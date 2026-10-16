'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const _ = require('lodash');
const { DEFAULT_SUBSCRIBED_PROPERTIES_CONTACT, DEFAULT_SUBSCRIBED_PROPERTIES_DEAL } = require('./commons');

// HubSpot recommends rejecting requests with a timestamp older than 5 minutes.
// See https://developers.hubspot.com/docs/api/webhooks/validating-requests
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

// Characters HubSpot URL-decodes in the request URI before computing the v3 signature.
const URI_DECODE_MAP = {
    '%3A': ':', '%2F': '/', '%3F': '?', '%40': '@', '%21': '!', '%24': '$',
    '%27': '\'', '%28': '(', '%29': ')', '%2A': '*', '%2C': ',', '%3B': ';'
};

module.exports = async (context) => {

    // Called by Appmixer when a listener is added to the plugin (eg. UpdatedContact component is started) to subscribe to HubSpot events.
    // This will create a subscription in HubSpot for the given subscriptionType if it does not exist.
    context.onListenerAdded(async (listener) => {

        /** Is this AuthHub or Engine pod? */
        const isAuthHubPod = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
        if (isAuthHubPod) {
            // This is AuthHub — the shared app's subscriptions are configured manually in its HubSpot
            // webhook settings, so there is nothing to register here.
            return;
        }

        const { eventName, params } = listener;
        const subscriptionType = eventName.split(':')[0];
        const subscriptions = getSubscriptionsByType(subscriptionType, context, params);
        if (!subscriptions?.length) {
            return;
        }

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
                // The v3 subscriptions API reports the state as `active` (v1 used `enabled`).
                const isActive = existing ? (existing.active ?? existing.enabled) : undefined;
                if (!existing) {
                    subscriptionsToCreate.push(sub);
                } else if (isActive === false) {
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
            // The raw body is needed to verify the X-HubSpot-Signature-v3 header.
            payload: {
                parse: false
            },
            handler: async (req, h) => {

                const rawBody = Buffer.isBuffer(req.payload) ? req.payload.toString('utf8') : (req.payload || '');
                if (!verifySignature(context, req, rawBody)) {
                    return h.response({ error: 'Invalid signature.' }).code(401);
                }

                let payload;
                try {
                    payload = rawBody ? JSON.parse(rawBody) : undefined;
                } catch (err) {
                    context.log('error', 'hubspot-plugin-route-webhook-invalid-payload', { error: err.message });
                    return h.response({ error: 'Invalid payload.' }).code(400);
                }

                await context.log('info', 'hubspot-plugin-route-webhook-hit', { eventCount: payload?.length });
                context.log('trace', 'hubspot-plugin-route-webhook-payload', { payload });
                if (!payload || typeof payload !== 'object') {
                    context.log('warn', 'hubspot-plugin-route-webhook-missing-payload');
                    return {};
                }
                const events = Array.isArray(payload) ? payload : [payload];
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
                    const eventsByObjectId = groupEventsByObjectId(filteredEvents);
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

// Verifies the X-HubSpot-Signature-v3 header: base64 HMAC-SHA256 of method + URI + raw body + timestamp,
// keyed with the app's client secret. Requests without a valid, recent signature are rejected.
function verifySignature(context, req, rawBody) {

    const clientSecret = context.config?.clientSecret;
    if (!clientSecret) {
        context.log('error', 'hubspot-plugin-route-webhook-missing-client-secret');
        return false;
    }

    const signature = req.headers?.['x-hubspot-signature-v3'];
    const timestamp = req.headers?.['x-hubspot-request-timestamp'];
    if (!signature || !timestamp) {
        context.log('error', 'hubspot-plugin-route-webhook-missing-signature');
        return false;
    }

    if (!(Math.abs(Date.now() - Number(timestamp)) <= MAX_SIGNATURE_AGE_MS)) {
        context.log('error', 'hubspot-plugin-route-webhook-expired-timestamp', { timestamp });
        return false;
    }

    const method = (req.method || 'POST').toUpperCase();
    const valid = getRequestUris(context, req).some(uri => {
        const expected = createHmac('sha256', clientSecret)
            .update(`${method}${uri}${rawBody}${timestamp}`)
            .digest('base64');
        return safeEqual(expected, signature);
    });

    if (!valid) {
        context.log('error', 'hubspot-plugin-route-webhook-invalid-signature');
    }
    return valid;
}

// The signed URI is the full URL HubSpot called. Behind a proxy the URL seen by the server can differ,
// so accept the public Appmixer API URL as well as the URL rebuilt from the (forwarded) request headers.
function getRequestUris(context, req) {

    const pathWithQuery = (req.url?.pathname || req.path || '') + (req.url?.search || '');
    const uris = [];

    if (context.appmixerApiUrl) {
        uris.push(context.appmixerApiUrl.replace(/\/+$/, '') + pathWithQuery);
    }

    const headers = req.headers || {};
    const protocol = (headers['x-forwarded-proto'] || '').split(',')[0].trim()
        || (req.url?.protocol || '').replace(':', '');
    const host = (headers['x-forwarded-host'] || '').split(',')[0].trim() || headers.host || req.url?.host;
    if (protocol && host) {
        uris.push(`${protocol}://${host}${pathWithQuery}`);
    }

    return [...new Set(uris)].map(uri => uri.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, match => {
        return URI_DECODE_MAP[match.toUpperCase()];
    }));
}

function safeEqual(a, b) {

    const bufferA = Buffer.from(String(a));
    const bufferB = Buffer.from(String(b));
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

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

// One entry per object, the last event wins (as HubSpot batches arrive in order). For propertyChange
// events, `propertyNames` lists every property of the object that changed in this batch — a single batch
// can carry several changes of the same object, and triggers that filter by property must see all of them.
function groupEventsByObjectId(events) {

    const eventsByObjectId = {};
    for (const event of events) {
        if (!event.propertyName) {
            eventsByObjectId[event.objectId] = event;
            continue;
        }
        const propertyNames = [...(eventsByObjectId[event.objectId]?.propertyNames || [])];
        if (!propertyNames.includes(event.propertyName)) {
            propertyNames.push(event.propertyName);
        }
        eventsByObjectId[event.objectId] = { ...event, propertyNames };
    }
    return eventsByObjectId;
}

// HubSpot has no "any property" subscription — every watched property is its own subscription, shared by
// all portals that installed the app (max 1000 per app). Register the defaults plus the property a
// ContactPropertyChanged trigger asks for (`propertyName`).
function propertyChangeSubscriptions(subscriptionType, defaultProperties, params = {}) {

    const propertySet = new Set(defaultProperties);
    if (params.propertyName) {
        propertySet.add(params.propertyName);
    }

    return Array.from(propertySet).map(propertyName => ({
        enabled: true,
        subscriptionDetails: {
            subscriptionType,
            propertyName
        }
    }));
}

function getSubscriptionsByType(subscriptionType, context, params = {}) {

    let subscriptions = [];

    if (subscriptionType === 'deal.propertyChange') {
        subscriptions = propertyChangeSubscriptions(subscriptionType, DEFAULT_SUBSCRIBED_PROPERTIES_DEAL, params);
    } else if (subscriptionType === 'contact.propertyChange') {
        subscriptions = propertyChangeSubscriptions(subscriptionType, DEFAULT_SUBSCRIBED_PROPERTIES_CONTACT, params);
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
        throw new Error(data?.error);
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
        throw new Error(result.data?.error);
    }

    return result;
}

async function activateHubSpotSubscription(context, hubspot, subscriptionId) {

    const result = await context.httpRequest({
        method: 'PATCH',
        url: `https://api.hubapi.com/webhooks/v3/${hubspot.appId}/subscriptions/${subscriptionId}?hapikey=${hubspot.apiKey}`,
        // v3 takes `active` — `enabled` is silently ignored and the subscription stays off.
        data: { active: true }
    });

    if (result.data?.ok === false) {
        throw new Error(result.data?.error);
    }

    return result;
}
