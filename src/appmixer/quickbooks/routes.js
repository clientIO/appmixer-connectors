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

    context.log('info', 'plugin-route-hit', { payload: req.payload, headers: req.headers });

    req.payload = req.payload || {};
    const realmIds = req.payload.eventNotifications?.map(notification => notification.realmId);
    if (!realmIds?.length) {
        context.log('error', 'plugin-route-error', 'Invalid payload');
        return {};
    }

    // Validates the payload with the intuit-signature hash
    const signature = req.headers['intuit-signature'];
    const webhooksVerifier = context.config.webhooksVerifier;
    const hash = crypto.createHmac('sha256', webhooksVerifier).update(JSON.stringify(req.payload)).digest('base64');
    if (signature !== hash) {
        context.log('error', 'Invalid signature', { signature, hash });
        return h.response('Forbidden: Invalid signature').code(403);
    }

    let registeredComponents = {};
    /**
     * Combination of `name` and `operation` from entities in the payload.
     * @example ['Customer.Create', 'Invoice.Create', 'Customer.Update'];
     * @type {string[]} */
    const triggerTypes = [...new Set(req.payload.eventNotifications.flatMap(notification => {
        return notification.dataChangeEvent.entities.map(entity => `${entity.name}.${entity.operation}`);
    }))];
    context.log('info', 'plugin-route-log', { triggerTypes });

    for (const realmId of realmIds) {
        registeredComponents[realmId] = {};
        for (const triggerType of triggerTypes) {
            registeredComponents[realmId][triggerType] = await context.service.stateGet(`${triggerType}:${realmId}`);
        }
    }

    const componentsCount = Object.values(registeredComponents)
        .reduce((acc, components) => acc + Object.values(components).length, 0);
    context.log('info', 'plugin-route-log', { registeredComponentsCount: componentsCount });

    // Loop over realmIds
    for (const realmId of realmIds) {
        // Loop over components registered for the realmId
        for (const triggerType of triggerTypes) {
            // Get all components registered for the realmId and triggerType
            const components = registeredComponents[realmId][triggerType] || [];
            // Get all entities for the realmId and triggerType
            const entities = req.payload.eventNotifications
                .find(notification => notification.realmId === realmId)
                .dataChangeEvent.entities.filter(entity => `${entity.name}.${entity.operation}` === triggerType);
            // Trigger the component for each entity
            for (const entity of entities) {
                for (const component of components) {
                    context.log('debug', 'plugin-route-log', 'trigger-component', realmId , component.flowId, component.componentId, entity);
                    await context.triggerComponent(
                        component.flowId,
                        component.componentId,
                        entity
                    );
                }
            }
        }
    }

    return {};
};
