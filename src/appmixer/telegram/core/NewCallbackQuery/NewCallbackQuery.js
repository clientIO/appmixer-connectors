'use strict';

const lib = require('../../lib');

/**
 * Which button presses this instance accepts. Shared by receive() and test() so Flow Test
 * Mode honours the same filters a live run does.
 * @param {object} properties - context.properties
 * @param {object} query - a callback query produced by lib.callbackFromUpdate
 * @returns {boolean}
 */
function matches(properties, query) {

    const { chatId, callbackData } = properties || {};

    if (callbackData && query.data !== callbackData) {
        return false;
    }

    if (!chatId) {
        return true;
    }

    const chat = (query.message && query.message.chat) || {};
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

        await context.addListener(`telegram-callback-${webhookId}`, { webhookId, secretToken });

        return context.saveState({ webhookId });
    },

    async stop(context) {

        const state = await context.loadState();
        const webhookId = (state && state.webhookId) || lib.getWebhookId(lib.getBotToken(context.auth));

        // See NewMessage.stop() - the webhook registration is shared, so it is left in place.
        return context.removeListener(`telegram-callback-${webhookId}`);
    },

    async receive(context) {

        if (!context.messages.webhook) {
            return;
        }

        const query = context.messages.webhook.content && context.messages.webhook.content.data;

        if (!query || !matches(context.properties, query)) {
            return;
        }

        await context.sendJson(query, 'out');
    },

    // Flow Test Mode: same constraint as NewMessage - getUpdates is read-only but Telegram
    // refuses it while a webhook is registered. Writes no state.
    async test(context) {

        let updates;

        try {
            updates = await lib.apiRequest(context, 'getUpdates', {
                limit: 20,
                allowed_updates: ['callback_query']
            });
        } catch (error) {
            throw new context.CancelError(
                'Cannot fetch a sample callback query while a Telegram webhook is registered for this bot - '
                + 'Telegram answers getUpdates with a 409 in that case. Stop the other running Telegram '
                + 'flows of this bot and try again, or press an inline-keyboard button for real. '
                + `Original error: ${error.message}`
            );
        }

        const queries = (updates || [])
            .map((update) => lib.callbackFromUpdate(update))
            .filter((query) => query && matches(context.properties, query));

        if (!queries.length) {
            throw new context.CancelError(
                'No recent callback query matches this trigger. Press an inline-keyboard button on one of '
                + 'the bot\'s messages and run the test again. Telegram only keeps undelivered updates for '
                + '24 hours.'
            );
        }

        return context.sendJson(queries[queries.length - 1], 'out');
    }
};
