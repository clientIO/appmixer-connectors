'use strict';

const crypto = require('crypto');

module.exports = async context => {

    context.http.router.register({
        method: 'GET',
        path: '/',
        options: {
            handler: () => ({ version: require('./bundle.json').version }),
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
    // Validates the payload with the signature hash
    const signature = req.headers['intuit-signature'];
    const webhookKey = context.config?.webhookVerifierToken;
    if (!webhookKey) {
        context.log('error', 'quickbooks-plugin-route-webhook-missing-key');
        return h.response('No Verifier Token found').code(403);
    }
    const hash = crypto.createHmac('sha256', webhookKey).update(JSON.stringify(req.payload)).digest('base64');
    if (signature !== hash) {
        context.log('debug', 'quickbooks-plugin-route-webhook-invalid-signature', { config: context.config });
        context.log('error', 'quickbooks-plugin-route-webhook-invalid-signature', { signature, hash });
        return h.response('Forbidden: Invalid signature').code(403);
    }

    let registeredComponents = {};
    const realmIds = req.payload.eventNotifications?.map(notification => notification.realmId);
    /**
     * Combination of `name` and `operation` from entities in the payload.
     * @example ['Customer.Create', 'Invoice.Create', 'Customer.Update'];
     * @type {string[]} */
    const triggerTypes = [...new Set(req.payload.eventNotifications.flatMap(notification => {
        return notification.dataChangeEvent.entities.map(entity => `${entity.name}.${entity.operation}`);
    }))];
    const eventsCount = req.payload.eventNotifications.flatMap(n => n.dataChangeEvent.entities).length;
    context.log('debug', 'quickbooks-plugin-route-webhook-log', { realmIds, triggerTypes, eventsCount });

    for (const realmId of realmIds) {
        registeredComponents[realmId] = {};
        for (const triggerType of triggerTypes) {
            const components = await context.service.stateGet(`${triggerType}:${realmId}`);
            if (components) {
                registeredComponents[realmId][triggerType] = components;
            }
        }
    }

    const componentsCount = Object.values(registeredComponents)
        .map(components => Object.values(components).filter(c => c).length)
        .reduce((acc, val) => acc + val, 0);
    context.log('debug', 'quickbooks-plugin-route-webhook-log', { registeredComponentsCount: componentsCount, registeredComponents });

    // Loop over realms
    for (const realmId of realmIds) {
        // Loop over components registered for the realm
        for (const triggerType of triggerTypes) {
            // Get all components registered for the realm and triggerType
            const components = registeredComponents[realmId][triggerType] || [];
            // Get all events/entities for the realm and triggerType
            const allEvents = req.payload.eventNotifications
                .find(n => n.realmId === realmId)?.dataChangeEvent.entities || [];
            const events = allEvents.filter(e => `${e.name}.${e.operation}` === triggerType);
            const entityIds = events.map(e => e.id);

            context.log('debug', 'quickbooks-plugin-route-webhook-log', { realmId, triggerType, components: components.length, events: events.length });
            // Send all the events once for each component
            for (const component of components) {
                context.log('debug', 'quickbooks-plugin-route-webhook-trigger-start', { realmId, component, entityIds });
                try {
                    const resp = await context.triggerComponent(
                        component.flowId,
                        component.componentId,
                        entityIds,
                        { enqueueOnly: true }, {}
                    );
                    await context.log('info', 'quickbooks-plugin-route-webhook-trigger-ok', { realmId, component, resp });
                } catch (error) {
                    await context.log('error', 'quickbooks-plugin-route-webhook-trigger-error', { realmId, component, error });
                }
            }
        }
    }

    context.log('info', 'quickbooks-plugin-route-webhook-success', { registeredComponentsCount: componentsCount });

    // Empty response
    return h.response(undefined).code(200);
};

/** Payload must have eventNotifications with realmId (at least one) and dataChangeEvent with entities */
function isPayloadValid(payload) {
    return Array.isArray(payload?.eventNotifications)
        && payload.eventNotifications?.map(notification => notification.realmId).length
        && Array.isArray(payload?.eventNotifications[0]?.dataChangeEvent?.entities);
}
