/* eslint-disable camelcase */
'use strict';

const lib = require('./lib');

// One global endpoint per bot:
//   <API_BASE>/plugins/appmixer/telegram/updates/{webhookId}
//
// Telegram allows exactly ONE webhook per bot, and getUpdates conflicts with it, so the
// per-trigger context.getWebhookUrl() model cannot work here - a second trigger would
// overwrite the first one's registration. Instead every trigger of the same bot registers
// the same derived URL (lib.getWebhookUrl) and subscribes via addListener; this route fans
// each update out to the listeners that match.
//
// webhookId is sha256(botToken + ':webhook-id') so the URL carries no credential.
// Authenticity is established in the listener filter: Telegram echoes the secret_token set
// at registration time in X-Telegram-Bot-Api-Secret-Token, and only a listener that holds
// the bot token can have registered the matching value. A POST to a guessed path therefore
// matches no listener and is dropped.

module.exports = async context => {

    context.onListenerAdded(async listener => {

        const { webhookId, secretToken } = listener.params || {};

        if (!webhookId || !secretToken) {
            throw new Error('Telegram listener requires params.webhookId and params.secretToken.');
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/updates/{webhookId}',
        options: {
            auth: false,
            handler: async (req, h) => {

                const { webhookId } = req.params;
                const update = req.payload;

                if (!update || typeof update !== 'object') {
                    context.log('error', 'telegram-plugin-route-update-missing', { webhookId });
                    return {};
                }

                const secretToken = req.headers['x-telegram-bot-api-secret-token'];

                context.log('trace', 'telegram-plugin-route-update-hit', {
                    webhookId,
                    updateId: update.update_id
                });

                await processUpdate(context, webhookId, secretToken, update);

                // Telegram retries on any non-2xx, so always answer 200 - a malformed or
                // unclaimed update must not turn into an endless redelivery loop.
                return {};
            }
        }
    });

    /**
     * Map one update onto the listener event it belongs to. The update -> payload mapping
     * lives in lib so the trigger's test() method emits the very same shape.
     */
    async function processUpdate(context, webhookId, secretToken, update) {

        const message = lib.messageFromUpdate(update);

        if (message) {
            await fanOut(context, `telegram-message-${webhookId}`, webhookId, secretToken, message);
            return;
        }

        const callback = lib.callbackFromUpdate(update);

        if (callback) {
            await fanOut(context, `telegram-callback-${webhookId}`, webhookId, secretToken, callback);
        }
    }

    /**
     * The filter is the authentication step - see the header comment.
     */
    async function fanOut(context, eventName, webhookId, secretToken, payload) {

        await context.triggerListeners({
            eventName,
            payload,
            filter: listener => {

                const params = listener.params || {};
                const valid = params.webhookId === webhookId && params.secretToken === secretToken;

                if (!valid) {
                    context.log('error', 'telegram-plugin-route-invalid-secret', { webhookId });
                }

                return valid;
            }
        });
    }
};
