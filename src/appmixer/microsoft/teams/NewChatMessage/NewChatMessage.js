'use strict';

const lib = require('../lib');
const subscriptions = require('../subscriptions');
const { makeRequest, statusOf } = require('../commons');
const { chatMessage: ITEM_SCHEMA } = require('../schemas');

// A notification names the message as `chats('19:..@thread.v2')/messages('1616..')`, with a
// `users('<me>')/` prefix when the subscription covers every chat of the user.
const RESOURCE = /chats\('([^']+)'\)\/messages\('([^']+)'\)/;

/**
 * Read one message. The notification carries no content, and a listing projection can omit
 * fields, so both receive() and test() emit what this returns.
 * @param {object} context
 * @param {string} chatId
 * @param {string} messageId
 * @return {Promise<object>}
 */
const fetchMessage = async (context, chatId, messageId) => {

    const { data } = await makeRequest(context, {
        method: 'GET',
        path: lib.messagePath({ location: 'chat', chatId, messageId })
    });

    return data;
};

/**
 * @param {object} message
 * @param {boolean} ignoreOwnMessages
 * @param {string} [meId]
 * @return {boolean}
 */
const shouldEmit = (message, ignoreOwnMessages, meId) => {

    // Joins, renames and the like are delivered as messages but are not ones.
    if (message.messageType !== 'message') {
        return false;
    }

    // Without this a flow that also posts to the chat would trigger itself.
    return !(ignoreOwnMessages && meId && message.from?.user?.id === meId);
};

module.exports = {

    ITEM_SCHEMA,

    async start(context) {

        const { chatId } = context.properties;
        const me = await lib.getMe(context);

        // Needed to recognize the user's own messages later.
        await context.stateSet('meId', me.id);

        const resource = chatId
            ? `/chats/${chatId}/messages`
            : `/users/${me.id}/chats/getAllMessages`;

        return subscriptions.start(context, { resource, changeType: 'created' });
    },

    async stop(context) {

        return subscriptions.stop(context);
    },

    async receive(context) {

        if (context.messages.timeout) {
            return subscriptions.renew(context);
        }

        if (!context.messages.webhook) {
            return;
        }

        if (subscriptions.isValidation(context)) {
            return;
        }

        const { ignoreOwnMessages = true } = context.properties;
        const meId = await context.stateGet('meId');
        const notifications = context.messages.webhook.content.data?.value || [];

        for (const notification of notifications) {

            // A notification without our secret did not come from this subscription.
            if (!await subscriptions.isOurs(context, notification)) {
                continue;
            }
            if (await subscriptions.handleLifecycle(context, notification)) {
                continue;
            }

            const match = RESOURCE.exec(notification.resource || '');
            if (!match) {
                continue;
            }
            const [, chatId, messageId] = match;

            let message;
            try {
                message = await fetchMessage(context, chatId, messageId);
            } catch (error) {
                // Notifications can arrive after the message was deleted.
                if (statusOf(error) === 404) {
                    continue;
                }
                throw error;
            }

            if (shouldEmit(message, ignoreOwnMessages, meId)) {
                await context.sendJson(message, 'out');
            }
        }

        return context.response('', 200);
    },

    async test(context) {

        // Flow Test Mode: no notification fires, so take the newest message of the watched
        // chat and emit it through the same fetch path receive() uses.
        const { ignoreOwnMessages = true } = context.properties;
        let { chatId } = context.properties;

        if (!chatId) {
            const { data } = await makeRequest(context, {
                method: 'GET',
                path: '/me/chats',
                params: { $top: 1, $orderby: 'lastMessagePreview/createdDateTime desc' }
            });
            chatId = (data.value || [])[0]?.id;
        }
        if (!chatId) {
            throw new Error('No chats to use as test data.');
        }

        const { data } = await makeRequest(context, {
            method: 'GET',
            path: `/chats/${encodeURIComponent(chatId)}/messages`,
            params: { $top: 1, $orderby: 'createdDateTime desc' }
        });
        const newest = (data.value || [])[0];
        if (!newest) {
            throw new Error('No recent messages in the chat to use as test data.');
        }

        const message = await fetchMessage(context, chatId, newest.id);
        const me = await lib.getMe(context);

        if (!shouldEmit(message, ignoreOwnMessages, me.id)) {
            throw new Error('The newest message is one this trigger skips: a system event or your own message.');
        }

        return context.sendJson(message, 'out');
    }
};
