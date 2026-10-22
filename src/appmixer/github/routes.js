'use strict';

const lib = require('./lib');

// GitHub organization webhooks deliver to ONE URL per webhook, and an organization webhook can
// only be managed by an organization owner. So the connector does not register webhooks itself:
// an owner points an organization webhook at this plugin's endpoint once
// (`<API_BASE>/plugins/appmixer/github/events`, see README), and every trigger that wants the
// events subscribes with `context.addListener()`. Deliveries are verified against the
// `webhookSecret` of the connector's service configuration before anything is routed.
module.exports = async context => {

    context.onListenerAdded(async listener => {

        const { organization, projectNodeId, events } = listener.params || {};
        if (!organization) {
            throw new Error('A listener needs the organization whose webhook it consumes.');
        }
        listener.params = {
            organization: String(organization).trim().toLowerCase(),
            projectNodeId: String(projectNodeId || '').trim(),
            events: Array.isArray(events) && events.length ? events : ['edited']
        };
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            // GitHub signs the raw body; keep it unparsed so the digest is computed over the exact
            // bytes GitHub sent, not over a re-serialization.
            payload: {
                parse: false,
                output: 'data'
            },
            handler: async (req, h) => {

                const event = req.headers['x-github-event'];
                const delivery = req.headers['x-github-delivery'];
                await context.log('info', 'github-plugin-route-events-hit', { event, delivery });

                const secret = context.config?.webhookSecret;
                if (!secret) {
                    await context.log('error', 'github-plugin-route-events-missing-webhookSecret');
                    return h.response({ error: 'The connector has no webhookSecret configured.' }).code(401);
                }
                const valid = lib.verifyWebhookSignature({
                    payload: req.payload,
                    signatureHeader: req.headers['x-hub-signature-256'],
                    secret
                });
                if (!valid) {
                    await context.log('error', 'github-plugin-route-events-invalid-signature', { event, delivery });
                    return h.response({ error: 'Invalid X-Hub-Signature-256.' }).code(401);
                }

                let payload;
                try {
                    payload = JSON.parse(Buffer.isBuffer(req.payload) ? req.payload.toString('utf8') : String(req.payload || ''));
                } catch (err) {
                    return h.response({ error: 'The body is not JSON.' }).code(400);
                }

                // GitHub sends `ping` right after the webhook is created.
                if (event === 'ping') {
                    return { ok: true, zen: payload.zen };
                }

                if (event === 'projects_v2_item') {
                    await routeProjectItem(context, payload);
                    return { ok: true };
                }

                // Other events of the same webhook (nothing consumes them yet) are acknowledged, so
                // GitHub does not mark the delivery as failed.
                await context.log('debug', 'github-plugin-route-events-unhandled', { event, delivery });
                return { ok: true, ignored: event };
            }
        }
    });

    /**
     * Fans a `projects_v2_item` delivery to the triggers subscribed to its organization, board
     * and action.
     * @param {Object} context
     * @param {Object} payload
     */
    async function routeProjectItem(context, payload) {

        const organization = String(payload.organization?.login || '').toLowerCase();
        const item = payload.projects_v2_item || {};
        const action = payload.action || '';
        if (!organization || !item.node_id) {
            await context.log('error', 'github-plugin-route-events-projects_v2_item-malformed', { action });
            return;
        }

        await context.triggerListeners({
            eventName: 'projects_v2_item',
            payload,
            filter: listener => {
                const { organization: wanted, projectNodeId, events } = listener.params || {};
                return wanted === organization
                    && (!projectNodeId || projectNodeId === item.project_node_id)
                    && (events || []).includes(action);
            }
        });
    }
};
