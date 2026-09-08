'use strict';

const lib = require('../../lib');

/**
 * Which updates this instance accepts. Telegram's single per-bot webhook delivers every
 * update kind for every chat, so the per-instance narrowing has to happen here rather than
 * at registration time. Shared by receive() and test() so Flow Test Mode honours the same
 * filters a live run does.
 * @param {object} properties - context.properties
 * @param {object} message - a message produced by lib.messageFromUpdate
 * @returns {boolean}
 */
function matches(properties, message) {

    const { chatId, includeEdited, includeChannelPosts } = properties || {};
    const kind = message.update_kind;

    if ((kind === 'edited_message' || kind === 'edited_channel_post') && !includeEdited) {
        return false;
    }

    if ((kind === 'channel_post' || kind === 'edited_channel_post') && !includeChannelPosts) {
        return false;
    }

    if (!chatId) {
        return true;
    }

    const chat = message.chat || {};
    const wanted = String(chatId).trim();

    return String(chat.id) === wanted
        || (!!chat.username && chat.username === wanted.replace(/^@/, ''));
}

module.exports = {

    async start(context) {

        const botToken = lib.getBotToken(context.auth);
        const webhookId = lib.getWebhookId(botToken);
        const secretToken = lib.getSecretToken(botToken);

        // Idempotent across every Telegram trigger of this bot - they all write the same URL.
        await lib.registerWebhook(context, webhookId, secretToken);

        await context.addListener(`telegram-message-${webhookId}`, { webhookId, secretToken });

        return context.saveState({ webhookId });
    },

    async stop(context) {

        const state = await context.loadState();
        const webhookId = (state && state.webhookId) || lib.getWebhookId(lib.getBotToken(context.auth));

        // Deliberately NOT calling deleteWebhook: the registration is shared by every Telegram
        // trigger of this bot, so removing it here would silence sibling flows. An orphaned
        // registration is harmless - updates arrive, match no listener and are dropped.
        return context.removeListener(`telegram-message-${webhookId}`);
    },

    async receive(context) {

        if (!context.messages.webhook) {
            return;
        }

        // Placed there by routes.js -> triggerListeners().
        const message = context.messages.webhook.content && context.messages.webhook.content.data;

        if (!message || !matches(context.properties, message)) {
            return;
        }

        await context.sendJson(message, 'out');
    },

    // Flow Test Mode: getUpdates is the only read-only way to see a real inbound message, and
    // Telegram refuses it with a 409 while a webhook is registered. Read-only, writes no state.
    async test(context) {

        let updates;

        try {
            updates = await lib.apiRequest(context, 'getUpdates', {
                limit: 20,
                allowed_updates: lib.MESSAGE_KINDS
            });
        } catch (error) {
            throw new context.CancelError(
                'Cannot fetch a sample message while a Telegram webhook is registered for this bot - '
                + 'Telegram answers getUpdates with a 409 in that case. Stop the other running Telegram '
                + 'flows of this bot and try again, or just send a real message to the bot. '
                + `Original error: ${error.message}`
            );
        }

        const messages = (updates || [])
            .map((update) => lib.messageFromUpdate(update))
            .filter((message) => message && matches(context.properties, message));

        if (!messages.length) {
            throw new context.CancelError(
                'No recent message matches this trigger. Send a message to the bot (or to the configured '
                + 'chat) and run the test again. Telegram only keeps undelivered updates for 24 hours.'
            );
        }

        // Newest matching message, shaped exactly as receive() emits it.
        return context.sendJson(messages[messages.length - 1], 'out');
    }
};
