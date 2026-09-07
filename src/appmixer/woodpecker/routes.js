'use strict';

const lib = require('./lib');

// Woodpecker webhooks are account-level: a single callback URL receives events for every
// campaign in the account, batched as an array (<= 100 events). Because Woodpecker is an
// API-key (per-tenant) service rather than a shared OAuth app, every tenant registers its
// own webhook pointing at this connector's single shared plugin endpoint:
//   <API_BASE>/plugins/appmixer/woodpecker/events
// Inbound events are then fanned out to the subscribed trigger instances via
// context.triggerListeners(), scoped by event name and company id.
module.exports = async context => {

    // Runs every time a trigger calls context.addListener() (i.e. when a trigger flow starts).
    // It makes sure the account-level webhook for the requested event is registered in Woodpecker.
    context.onListenerAdded(async listener => {

        const { params } = listener;
        const { apiKey, event } = params || {};

        if (!apiKey || !event) {
            return;
        }

        const targetUrl = `${context.appmixerApiUrl}/plugins/appmixer/woodpecker/events`;
        const cacheKey = `woodpecker_webhook_${event}_${params.companyId}`;

        let lock;
        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return;
            }

            // Look up existing webhooks for this account to keep registration idempotent.
            let existing = [];
            try {
                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: `${lib.API_BASE_URL}/v2/webhooks`,
                    headers: { 'x-api-key': apiKey }
                });
                existing = Array.isArray(data) ? data : (data?.webhooks || data?.data || []);
            } catch (err) {
                context.log('warn', 'woodpecker-plugin-list-webhooks-failed', { error: err.message });
            }

            const alreadyRegistered = existing.some(wh => {
                const url = wh.target_url || wh.url;
                const events = wh.events || (wh.event ? [wh.event] : []);
                return url === targetUrl && events.includes(event);
            });

            if (!alreadyRegistered) {
                await context.httpRequest({
                    method: 'POST',
                    url: `${lib.API_BASE_URL}/v2/webhooks`,
                    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                    data: {
                        target_url: targetUrl,
                        events: [event]
                    }
                });
                context.log('info', 'woodpecker-plugin-webhook-registered', { event, targetUrl });
            }

            await context.staticCache.set(
                cacheKey,
                targetUrl,
                context.config?.webhookTargetURLCacheTTL || (60 * 60 * 1000)
            );
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', 'woodpecker-plugin-listener-added-error', { error: err.message });
            }
        } finally {
            await lock?.unlock();
        }
    });

    // Called by Woodpecker when one or more events occur (batched array payload).
    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req) => {

                const payload = req.payload;
                const events = Array.isArray(payload) ? payload : [payload];

                context.log('info', 'woodpecker-plugin-route-webhook-hit', { eventCount: events.length });
                if (context.config?.logWebhookPayloads) {
                    context.log('trace', 'woodpecker-plugin-route-webhook-payload', { payload });
                }

                for (const event of events) {
                    if (!event || typeof event !== 'object') {
                        continue;
                    }

                    const eventType = extractEventType(event);
                    const companyId = extractCompanyId(event);
                    if (!eventType || !companyId) {
                        // Events without a company id cannot be routed to a tenant's listener.
                        continue;
                    }

                    await context.triggerListeners({
                        eventName: `${eventType}:${companyId}`,
                        payload: event
                    });
                }

                return {};
            }
        }
    });
};

// Woodpecker event payloads identify the event under one of these keys depending on the
// endpoint version; check the common variants.
function extractEventType(event) {
    return event.event || event.type || event.event_type || event.eventType || null;
}

// The account/company identifier used to route an event to the right tenant's listeners.
function extractCompanyId(event) {
    return event.company_id || event.companyId || event.company || event.account_id || event.accountId || null;
}
