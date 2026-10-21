/* eslint-disable camelcase */
'use strict';

const { WebClient } = require('@slack/web-api');
const { isValidPayload } = require('./lib.js');

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

                if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
                    // Return 400 Bad Request if the content type is not JSON
                    // Example: Someone configures interaction (Request Approval) URL the same as the event URL in Slack.
                    return h.response({ error: 'Invalid content type' }).code(400);
                }

                await context.log('info', 'slack-plugin-route-webhook-event-hit', { type: req.payload?.type });
                context.log('trace', 'slack-plugin-route-webhook-event-payload', { payload: req.payload });

                // Validates the payload with the Slack-signature hash
                if (!isValidPayload(context, req)) {
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
                    context.log('error', 'slack-plugin-route-webhook-event-event-missing', req.payload);
                    return {};
                }
                if (event.hidden) {
                    return {};
                }

                context.log('info', 'slack-plugin-route-webhook-event-event-type', { type: event.type });
                switch (event.type) {
                    case 'message':
                        await processMessages(context, req);
                        break;
                    case 'team_join':
                        await processNewUsers(context, req);
                        break;
                    default:
                        context.log('error', 'slack-plugin-route-webhook-event-event-type-unsupported', { type: event.type });
                        break;
                }

                return {};
            }
        }
    });

    const isAuthHubPod = !!process.env.AUTH_HUB_URL && !process.env.AUTH_HUB_TOKEN;
    if (isAuthHubPod) {
        // Register API route for sending bot messages in AuthHub only.
        context.http.router.register({
            method: 'POST',
            path: '/auth-hub/send-message',
            options: {
                handler: async (req, h) => {

                    const {
                        iconUrl, username, channelId, text, thread_ts, reply_broadcast, token, blocks
                    } = req.payload;
                    await context.log('debug', 'slack-plugin-route-auth-hub-send-message', { iconUrl, username, channelId, text, thread_ts, reply_broadcast, blocks });
                    if (!channelId || !text) {
                        context.log('error', 'slack-plugin-route-webhook-event-send-message-missing-params', req.payload);
                        return h.response(undefined).code(400);
                    }

                    const message = await sendBotMessageFromAuthHub(
                        { iconUrl, username, channelId, text, thread_ts, reply_broadcast, token, blocks }
                    );
                    return h.response(message).code(200);
                }
            }
        });

        // Easily check the version of the plugin in AuthHub.
        context.http.router.register({
            method: 'GET',
            path: '/auth-hub/version',
            options: {
                handler: () => ({ version: require('./bundle.json').version }),
                auth: false
            }
        });
    }

    /** Supposed to be called from AuthHub only. */
    async function sendBotMessageFromAuthHub(
        { iconUrl, username, channelId, text, thread_ts, reply_broadcast, token, blocks }
    ) {

        const web = new WebClient(token);

        const response = await web.chat.postMessage({
            icon_url: iconUrl,
            username,
            channel: channelId,
            text,
            ...(blocks ? { blocks } : {}),
            ...(thread_ts ? { thread_ts } : {}),
            ...(typeof reply_broadcast === 'boolean' ? { reply_broadcast } : {})
        });
        return response.message;
    }

    /**
     * Slack users (of any workspace) the app is authorized for in the workspace the event came from.
     * Listeners carry the Slack user_id of their owner (see onListenerAdded), so filtering on this list
     * delivers an event only to listeners of that workspace.
     * @return {Promise<string[]|null>} null when Slack refused the lookup (nothing should be delivered)
     */
    async function getAuthorizedUserIds(context, req) {

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
            return null;
        }

        return (response?.data?.authorizations || []).map(item => item['user_id']);
    }

    async function processMessages(context, req) {

        const { event } = req.payload;
        const channelId = event?.channel;
        if (!channelId) {
            context.log('error', 'Missing channel property.', req.payload);
            return;
        }

        const authorizedUsers = await getAuthorizedUserIds(context, req);
        if (!authorizedUsers) {
            return {};
        }
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

        if (!context.config?.authToken) {
            // The authorization lookup needs the app token, and New User (unlike message triggers) only ever
            // required the signing secret - an install without it keeps the unfiltered delivery.
            context.log('warn', 'slack-plugin-route-webhook-event-team-join-unfiltered', {
                reason: 'Missing authToken: team_join cannot be scoped to its workspace.'
            });
            await context.triggerListeners({ eventName: 'slack_team_join', payload: event.user });
            return;
        }

        // A team_join of one workspace is for the New User triggers of that workspace only - the same
        // authorization filter as messages. Without it every listener, in every tenant using the app,
        // received the profile of anyone joining any workspace that installed it.
        const authorizedUsers = await getAuthorizedUserIds(context, req);
        if (!authorizedUsers) {
            return;
        }
        await context.triggerListeners({
            eventName: 'slack_team_join',
            payload: event.user,
            filter: listener => authorizedUsers.indexOf(listener.params?.userId) !== -1
        });
    }
};
