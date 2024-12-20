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
            },
            handler: async (req, h) => {
                return module.exports.webhookHandler(context, req, h);
            }
        }
    });
};

module.exports.webhookHandler = async (context, req, h) => {

    context.log('info', 'xero-plugin-route-webhook-hit');

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

    context.log('debug', 'xero-plugin-route-webhook-payload', { payload: req.payload });

    const tenantIds = [...new Set(req.payload.events?.map(event => event.tenantId))];
    /**
	 * Combination of eventType and eventCategory
	 * @example ['CONTACT.CREATE', 'INVOICE.CREATE', 'CONTACT.UPDATE'];
	 * @type {string[]} */
    const triggerTypes = [...new Set(req.payload.events.flatMap(event => {
        return `${event.eventCategory}.${event.eventType}`;
    }))];
    context.log('debug', 'xero-plugin-route-webhook-log', { tenantIds, triggerTypes, events: req.payload.events.length });

    let totalEventCount = 0;
    for (const tenantId of tenantIds) {
        for (const triggerType of triggerTypes) {
            const eventName = `${triggerType}:${tenantId}`;
            // Send only resourceIds as array of strings.
            const payload = req.payload.events
                .filter(event => `${event.eventCategory}.${event.eventType}` === triggerType && event.tenantId === tenantId)
                .map(event => event.resourceId);
            const eventCount = payload.length;
            totalEventCount += eventCount;
            if (eventCount === 0) {
                continue;
            }
            await context.triggerListeners({
                eventName,
                payload
            });
            await context.log('info', 'xero-plugin-route-webhook-trigger-ok', { tenantId, triggerType });
        }
    }

    context.log('info', 'xero-plugin-route-webhook-success', { totalEventCount });

    // Empty response
    return h.response(undefined).code(200);
};
