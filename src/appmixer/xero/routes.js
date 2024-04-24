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
            payload: {
                parse: false
                // allow: ['application/json charset=utf-8', 'application/json']
            },
            handler: async (req, h) => {
                return module.exports.webhookHandler(context, req, h);
            }
        }
    });
};

module.exports.webhookHandler = async (context, req, h) => {

    context.log('info', 'xero-plugin-route-webhook-hit', { payload: req.payload });

    /** Raw payload from the webhook. We can't use the parsed payload as it's already parsed by the framework.
     *  We can't use JSON.stringify(req.payload) as it will remove any whitespace and the signature will not match
	 * @type {string} */
    const payloadString = req.payload?.toString('utf8');
    try {
    	req.payload = JSON.parse(payloadString);
    } catch (e) {
        context.log('error', 'xero-plugin-route-webhook-invalid-payload');
        return h.response().code(200);
    }

    // Validates the payload with the Xero-signature hash
    const signature = req.headers['x-xero-signature'];
    const webhookKey = context.config?.webhookKey;
    if (!webhookKey) {
        context.log('error', 'xero-plugin-route-webhook-missing-key');
        return h.response(undefined).code(401);
    }
    const hash = crypto.createHmac('sha256', webhookKey).update(payloadString).digest('base64');
    if (signature !== hash) {
        context.log('debug', 'xero-plugin-route-webhook-invalid-signature', { config: context.config });
        context.log('error', 'xero-plugin-route-webhook-invalid-signature', { signature, hash });
        return h.response(undefined).code(401);
    }

    let registeredComponents = {};
    const tenantIds = [...new Set(req.payload.events?.map(event => event.tenantId))];
    /**
	 * Combination of eventType and eventCategory
	 * @example ['CONTACT.Create', 'INVOICE.Create', 'CONTACT.Update'];
	 * @type {string[]} */
    const triggerTypes = [...new Set(req.payload.events.flatMap(event => {
        return `${event.eventCategory}.${event.eventType}`;
    }))];
    context.log('debug', 'xero-plugin-route-webhook-log', { tenantIds, triggerTypes, events: req.payload.events.length });

    for (const tenantId of tenantIds) {
        registeredComponents[tenantId] = {};
        for (const triggerType of triggerTypes) {
            const components = await context.service.stateGet(`${triggerType}:${tenantId}`);
            if (components) {
                registeredComponents[tenantId][triggerType] = components;
            }
        }
    }

    const componentsCount = Object.values(registeredComponents)
        .map(components => Object.values(components).filter(c => c).length)
        .reduce((acc, val) => acc + val, 0);
    context.log('debug', 'xero-plugin-route-webhook-log', { registeredComponentsCount: componentsCount, registeredComponents });

    // Loop over tenants
    for (const tenantId of tenantIds) {
        // Loop over components registered for the tenant
        for (const triggerType of triggerTypes) {
            // Get all components registered for the tenant and triggerType
            const components = registeredComponents[tenantId][triggerType] || [];
            // Get all events for the tenant and triggerType
            const events = req.payload.events
                .filter(event => event.tenantId === tenantId && `${event.eventCategory}.${event.eventType}` === triggerType);
            const resourceIds = events.map(event => event.resourceId);

            context.log('debug', 'xero-plugin-route-webhook-log', triggerType, components.length, events.length);
            // Send all the events once for each component
            for (const component of components) {
                context.log('debug', 'xero-plugin-route-webhook-trigger-start', { tenantId, component, events });
                try {
                    const resp = await context.triggerComponent(
                        component.flowId,
                        component.componentId,
                        resourceIds,
                        { enqueueOnly: true }, {}
                    );
                    await context.log('info', 'xero-plugin-route-webhook-trigger-ok', { tenantId, component, resp });
                } catch (error) {
                    await context.log('error', 'xero-plugin-route-webhook-trigger-error', { tenantId, component, error });
                }
            }
        }
    }

    context.log('info', 'xero-plugin-route-webhook-success', { registeredComponentsCount: componentsCount });

    // Empty response
    return h.response(undefined).code(200);
};
