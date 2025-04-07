'use strict';

const { WebClient } = require('@slack/web-api');
const { createHmac } = require('node:crypto');

module.exports = async context => {

    context.onListenerAdded(async listener => {

        // Components have to send the accessToken (not directly the Slack user_id) and
        // the accessToken is used to get the user_id. This way it is ensured that the
        // registered user_id belongs to the owner of the accessToken.

        const response = await context.httpRequest({
            method: 'GET',
            url: 'https://slack.com/api/auth.test',
            headers: {
                Authorization: `Bearer ${listener.params.accessToken}`
            }
        });

        if (response?.data?.ok === false) {
            throw new Error(response?.data?.error);
        }

        if (!response?.data['user_id']) {
            throw new Error('Missing user_id property.');
        }

        listener.params = {
            userId: response.data['user_id']
        };
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req, h) => {

                await context.log('info', 'slack-plugin-route-webhook-hit', { type: req.payload?.type });
                context.log('trace', 'slack-plugin-route-webhook-payload', { payload: req.payload });

                // Validates the payload with the Slack-signature hash
                const slackSignature = req.headers['x-slack-signature'];
                const signingSecret = context.config?.signingSecret;
                if (!signingSecret) {
                    context.log('error', 'slack-plugin-route-webhook-missing-signingSecret');
                    return h.response(undefined).code(401);
                }
                // Use the raw request body from `req.payload`, without headers, before it has been deserialized from JSON or other forms. See https://stackoverflow.com/questions/70653161/unable-to-correctly-verify-slack-requests.
                const payloadString = JSON.stringify(req.payload)
                    .replace(/\//g, '\\/')
                    .replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));

                const timestamp = req.headers['x-slack-request-timestamp'];
                const baseString = `v0:${timestamp}:${payloadString}`;
                const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');
                if (slackSignature !== mySignature) {
                    context.log('info', 'slack-plugin-route-webhook-invalid-signature', { config: context.config });
                    context.log('error', 'slack-plugin-route-webhook-invalid-signature', { slackSignature, mySignature, baseString, payloadString });
                    return h.response(undefined).code(401);
                }

                if (req.payload.challenge) {
                    return { challenge: req.payload.challenge };
                }

                if (req.payload.type !== 'event_callback') {
                    return {};
                }

                const event = req.payload.event;
                if (!event) {
                    context.log('error', 'slack-plugin-route-webhook-event-missing', req.payload);
                    return {};
                }
                if (event.hidden) {
                    return {};
                }

                context.log('info', 'slack-plugin-route-webhook-event-type', { type: event.type });
                switch (event.type) {
                    case 'message':
                        await processMessages(context, req);
                        break;
                    case 'team_join':
                        await processNewUsers(context, req);
                        break;
                    default:
                        context.log('error', 'slack-plugin-route-webhook-event-type-unsupported', { type: event.type });
                        break;
                }

                return {};
            }
        }
    });

    // Register API route for sending messages from AuthHub only.
    context.http.router.register({
        method: 'POST',
        path: '/auth-hub/send-message',
        options: {
            auth: false,
            handler: async (req, h) => {

                const { iconUrl, username, channelId, text } = req.payload;
                if (!channelId || !text) {
                    context.log('error', 'slack-plugin-route-webhook-send-message-missing-params', req.payload);
                    return h.response(undefined).code(400);
                }

                const message = await sendBotMessageFromAuthHub(context, { iconUrl, username, channelId, text });
                return h.response(message).code(200);
            }
        }
    });

    /** Supposed to be called from AuthHub only. */
    async function sendBotMessageFromAuthHub(context, { iconUrl, username, channelId, text }) {

        const web = new WebClient(context.config?.botToken);

        const response = await web.chat.postMessage({
            icon_url: iconUrl,
            username,
            channel: channelId,
            text
        });
        return response.message;
    }

    async function processMessages(context, req) {

        const { event } = req.payload;
        const channelId = event?.channel;
        if (!channelId) {
            context.log('error', 'Missing channel property.', req.payload);
            return;
        }

        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://slack.com/api/apps.event.authorizations.list',
            headers: {
                Authorization: `Bearer ${context.config.authToken}`
            },
            data: {
                event_context: req.payload.event_context
            }
        });

        if (response?.data?.ok === false) {
            context.log('error', response?.data?.error);
            return {};
        }

        const authorizedUsers = response.data.authorizations.map(item => item['user_id']);
        await context.triggerListeners({
            eventName: channelId,
            payload: event,
            filter: listener => {
                return authorizedUsers.indexOf(listener.params.userId) !== -1;
            }
        });
    }

    async function processNewUsers(context, req) {

        const { event } = req.payload;
        if (!event?.user) {
            context.log('error', 'slack-plugin-route-webhook-event-user-missing', req.payload);
            return;
        }

        await context.triggerListeners({
            eventName: 'slack_team_join',
            payload: event.user
        });
    }
};
