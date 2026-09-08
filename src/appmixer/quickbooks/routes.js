'use strict';

const crypto = require('crypto');

module.exports = async context => {

    context.onListenerAdded(async listener => {

        // Components register with `realmId` (the QuickBooks company id) as a listener param.
        // Unlike Slack (which resolves userId from an accessToken), the realmId is passed
        // directly by the component, so no API call is needed here. We only validate and
        // normalize the params so the webhook handler can filter listeners by realmId.
        const realmId = listener.params?.realmId;
        if (!realmId) {
            throw new Error('Missing realmId listener param.');
        }

        listener.params = { realmId: `${realmId}` };
    });

    context.http.router.register({
        method: 'GET',
        path: '/',
        options: {
            // bundle.json is not part of the deployed plugin package, so this must not throw
            // — the route exists as a liveness probe, the version is a nice-to-have.
            handler: () => {
                try {
                    return { version: require('./bundle.json').version };
                } catch (error) {
                    return { version: null };
                }
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/webhooks',
        options: {
            auth: false,
            handler: async (req, h) => {
                return module.exports.webhookHandler(context, req, h);
            }
        }
    });
};

module.exports.webhookHandler = async (context, req, h) => {

    context.log('info', 'quickbooks-plugin-route-webhook-hit', { payload: req.payload });

    if (!isPayloadValid(req.payload)) {
        context.log('error', 'quickbooks-plugin-route-webhook-missing-payload');
        return h.response().code(200);
    }
    // Validates the payload with the signature hash. Intuit issues a separate verifier token
    // for the Development (sandbox) and Production webhook sections of the app, and both can be
    // pointed at this single endpoint — realm-based listener filtering keeps the routing correct.
    // Accepts several tokens: `webhookVerifierToken` (comma-separated) plus an optional
    // `webhookVerifierTokenSandbox`.
    const signature = req.headers['intuit-signature'];
    const webhookKeys = [context.config?.webhookVerifierToken, context.config?.webhookVerifierTokenSandbox]
        .filter(Boolean)
        .flatMap(value => `${value}`.split(',').map(token => token.trim()).filter(Boolean));
    if (!webhookKeys.length) {
        context.log('error', 'quickbooks-plugin-route-webhook-missing-key');
        return h.response('No Verifier Token found').code(403);
    }
    const body = JSON.stringify(req.payload);
    const signatureValid = webhookKeys.some(
        key => crypto.createHmac('sha256', key).update(body).digest('base64') === signature
    );
    if (!signatureValid) {
        context.log('error', 'quickbooks-plugin-route-webhook-invalid-signature', { signature });
        return h.response('Forbidden: Invalid signature').code(403);
    }

    // Group entities by realm (tenant). A single payload may carry more than one notification
    // for the same realmId, so entities are merged instead of looked up by the first match.
    /** @type {Map<string, Array<object>>} */
    const entitiesByRealm = new Map();
    for (const notification of req.payload.eventNotifications) {
        const realmId = `${notification.realmId}`;
        const entities = notification.dataChangeEvent?.entities || [];
        entitiesByRealm.set(realmId, (entitiesByRealm.get(realmId) || []).concat(entities));
    }

    const realmIds = [...entitiesByRealm.keys()];
    const eventsCount = [...entitiesByRealm.values()].reduce((sum, entities) => sum + entities.length, 0);
    context.log('debug', 'quickbooks-plugin-route-webhook-log', { realmIds, eventsCount });

    // AuthHub delivers all tenants through this single shared endpoint, so we identify the
    // owner of each event by the realmId in the payload and route to registered listeners
    // filtered by that realmId.
    for (const [realmId, entities] of entitiesByRealm) {
        /**
         * Combination of `name` and `operation` from the realm's entities.
         * @example ['Customer.Create', 'Invoice.Create', 'Customer.Update'];
         * @type {string[]} */
        const triggerTypes = [...new Set(entities.map(entity => `${entity.name}.${entity.operation}`))];
        // Loop over trigger types (e.g. 'Invoice.Create')
        for (const triggerType of triggerTypes) {
            const entityIds = entities
                .filter(entity => `${entity.name}.${entity.operation}` === triggerType)
                .map(entity => entity.id);

            context.log('debug', 'quickbooks-plugin-route-webhook-trigger-start', { realmId, triggerType, entityIds });
            try {
                const resp = await context.triggerListeners({
                    eventName: triggerType,
                    payload: entityIds,
                    filter: listener => listener.params.realmId === realmId
                });
                await context.log('info', 'quickbooks-plugin-route-webhook-trigger-ok', { realmId, triggerType, resp });
            } catch (error) {
                await context.log('error', 'quickbooks-plugin-route-webhook-trigger-error', { realmId, triggerType, error });
            }
        }
    }

    context.log('info', 'quickbooks-plugin-route-webhook-success', { realmIds, eventsCount });

    // Empty response
    return h.response(undefined).code(200);
};

/** Payload must have eventNotifications with realmId (at least one) and dataChangeEvent with entities */
function isPayloadValid(payload) {
    return Array.isArray(payload?.eventNotifications)
        && payload.eventNotifications?.map(notification => notification.realmId).length
        && Array.isArray(payload?.eventNotifications[0]?.dataChangeEvent?.entities);
}
