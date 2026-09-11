'use strict';

const crypto = require('crypto');
const pathModule = require('path');
const FormData = require('form-data');

const API_BASE_URL = 'https://api.telegram.org';
const DEFAULT_PREFIX = 'telegram-objects-export';

// Telegram delivers every update type through ONE webhook per bot, so the registration
// cannot be tailored per trigger instance. Registering the full set we support instead
// makes setWebhook idempotent: two triggers on the same bot write the identical
// registration rather than overwriting each other's allowed_updates.
const ALLOWED_UPDATES = ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query'];

// Bots may upload at most 50 MB through the Bot API, but sendPhoto is capped lower.
// Keyed by method so the guard can never be paired with the wrong ceiling.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_LIMITS = {
    sendPhoto: 10 * 1024 * 1024,
    sendDocument: MAX_UPLOAD_BYTES
};

module.exports = {

    API_BASE_URL,
    ALLOWED_UPDATES,
    MAX_UPLOAD_BYTES,
    UPLOAD_LIMITS,

    /**
     * @param {object} auth - context.auth, or the context itself inside auth.js
     * @returns {string}
     */
    getBotToken(auth = {}) {

        return String(auth.botToken || '').trim();
    },

    /**
     * Opaque, deterministic per bot. Used as the plugin webhook's path segment so an
     * update can be routed to the right listeners without putting the bot token - which
     * grants full control of the bot - into a URL that ends up in access logs.
     * @param {string} botToken
     * @returns {string}
     */
    getWebhookId(botToken) {

        return crypto.createHash('sha256').update(`${botToken}:webhook-id`).digest('hex').slice(0, 32);
    },

    /**
     * Handed to Telegram as setWebhook's `secret_token`; Telegram returns it on every
     * update in the X-Telegram-Bot-Api-Secret-Token header. routes.js compares that header
     * against the value the listener registered, so a forged POST to a guessed path matches
     * no listener and is dropped. Derived from a different input than the webhook id, so
     * knowing the public path never reveals the expected header.
     * @param {string} botToken
     * @returns {string}
     */
    getSecretToken(botToken) {

        return crypto.createHash('sha256').update(`${botToken}:secret`).digest('hex').slice(0, 32);
    },

    /**
     * The one webhook URL for a bot. Shared by every trigger instance of that bot.
     * @param {object} context
     * @param {string} webhookId
     * @returns {string}
     */
    getWebhookUrl(context, webhookId) {

        return `${context.appmixerApiUrl}/plugins/appmixer/telegram/updates/${webhookId}`;
    },

    // The update kinds that all carry a Message and feed the New Message trigger.
    MESSAGE_KINDS: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],

    /**
     * Flatten a raw update into the Message the New Message trigger emits. Used by routes.js
     * on the live webhook path AND by the trigger's test() method, so Flow Test Mode cannot
     * drift from what a real run produces.
     * @param {object} update
     * @returns {object|null}
     */
    messageFromUpdate(update = {}) {

        for (const kind of this.MESSAGE_KINDS) {
            if (update[kind]) {
                return { ...update[kind], update_id: update.update_id, update_kind: kind };
            }
        }

        return null;
    },

    /**
     * Flatten a raw update into the callback query the New Callback Query trigger emits.
     * @param {object} update
     * @returns {object|null}
     */
    callbackFromUpdate(update = {}) {

        return update.callback_query
            ? { ...update.callback_query, update_id: update.update_id }
            : null;
    },

    /**
     * Point the bot's single webhook at this Appmixer instance. Every Telegram trigger of the
     * same bot writes the identical registration, so calling this from each trigger's start()
     * is idempotent rather than a race.
     * @param {object} context
     * @param {string} webhookId
     * @param {string} secretToken
     * @returns {Promise<*>}
     */
    async registerWebhook(context, webhookId, secretToken) {

        const url = this.getWebhookUrl(context, webhookId);

        // Telegram rate-limits setWebhook (roughly one call per second per bot). Two flows
        // of the same bot starting together - the E2E suite does exactly that - made the
        // second setWebhook fail with 429 and that flow never started. When a sibling has
        // already put the identical registration in place there is nothing to write, so
        // read first. The secret token is derived from the bot token, so the same URL
        // implies the same secret.
        try {
            const info = await this.apiRequest(context, 'getWebhookInfo');
            const registered = info && info.url === url
                && sameSet(info.allowed_updates, ALLOWED_UPDATES);

            if (registered) {
                return info;
            }
        } catch (error) {
            // A failed read only costs us the shortcut - fall through to setWebhook.
        }

        const payload = {
            url,
            secret_token: secretToken,
            allowed_updates: ALLOWED_UPDATES,
            // Keep whatever queued up while the flow was stopped - dropping it would lose
            // messages a user sent in the meantime.
            drop_pending_updates: false
        };

        for (let attempt = 0; ; attempt++) {
            try {
                return await this.apiRequest(context, 'setWebhook', payload);
            } catch (error) {
                if (error.status !== 429 || attempt >= 3) {
                    throw error;
                }
                // Telegram says how long to wait; cap it so a flow start never hangs for long.
                const seconds = Math.min(Number(error.retryAfter) || 1, 5);
                await new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 200));
            }
        }
    },

    /**
     * Authorized Bot API call. Telegram accepts JSON bodies on POST for every method and
     * answers `{ ok, result }`; this unwraps `result` and turns failures into CancelErrors.
     * @param {object} context
     * @param {string} method - Bot API method name, e.g. 'sendMessage'
     * @param {object} payload - request body; null/undefined/empty entries are dropped
     * @returns {Promise<*>} the unwrapped result
     */
    async apiRequest(context, method, payload = {}) {

        const token = this.getBotToken(context.auth || context);

        if (!token) {
            throw new context.CancelError('Bot Token is required!');
        }

        let response;

        try {
            response = await context.httpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/bot${token}/${method}`,
                headers: { 'Content-Type': 'application/json' },
                data: this.clean(payload)
            });
        } catch (error) {
            throw this.normalizeError(context, error, method);
        }

        if (response.data && response.data.ok === false) {
            throw this.normalizeError(context, { response }, method);
        }

        return response.data ? response.data.result : undefined;
    },

    /**
     * Multipart variant for the send methods that upload a file's bytes.
     * @param {object} context
     * @param {string} method
     * @param {object} form - a form-data instance
     * @returns {Promise<*>} the unwrapped result
     */
    async uploadRequest(context, method, form) {

        const token = this.getBotToken(context.auth || context);

        if (!token) {
            throw new context.CancelError('Bot Token is required!');
        }

        let response;

        try {
            response = await context.httpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/bot${token}/${method}`,
                headers: form.getHeaders(),
                data: form,
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
        } catch (error) {
            throw this.normalizeError(context, error, method);
        }

        if (response.data && response.data.ok === false) {
            throw this.normalizeError(context, { response }, method);
        }

        return response.data ? response.data.result : undefined;
    },

    /**
     * Shared body of SendPhoto/SendDocument. Telegram accepts an attachment in two ways and
     * the two need different transports: a URL or an existing Telegram file_id travels as a
     * plain JSON string field, while a stored file has to be streamed as multipart.
     * An uploaded file wins over the URL/file_id field when both are filled.
     *
     * @param {object} context
     * @param {string} method - 'sendPhoto' | 'sendDocument'
     * @param {string} field - the Bot API field carrying the attachment
     * @param {object} options - { fileId, remote, fileName, params }
     * @returns {Promise<object>} the sent Message
     */
    async sendMedia(context, method, field, { fileId, remote, fileName, params = {} } = {}) {

        if (!fileId) {
            if (!remote) {
                throw new context.CancelError(
                    `Provide either a URL / Telegram file ID, or pick a stored file to upload for ${field}.`
                );
            }
            return this.apiRequest(context, method, { ...params, [field]: remote });
        }

        let fileInfo;

        try {
            fileInfo = await context.getFileInfo(fileId);
        } catch (error) {
            throw new context.CancelError('Invalid File. Failed to read the file from storage.');
        }

        const maxBytes = UPLOAD_LIMITS[method] || MAX_UPLOAD_BYTES;

        if (fileInfo.length > maxBytes) {
            throw new context.CancelError(
                `Maximum upload size for ${method} is ${Math.round(maxBytes / (1024 * 1024))}MB.`
            );
        }

        const stream = await context.getFileReadStream(fileId);
        const form = new FormData();

        for (const [key, value] of Object.entries(this.clean(params))) {
            // form-data only accepts strings and buffers; booleans and numbers need coercing.
            form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }

        form.append(field, stream, {
            filename: fileName || fileInfo.filename,
            contentType: fileInfo.contentType || 'application/octet-stream'
        });

        return this.uploadRequest(context, method, form);
    },

    /**
     * Translate a Bot API failure into a CancelError carrying Telegram's own description.
     * @param {object} context
     * @param {Error} error
     * @param {string} method
     * @returns {Error}
     */
    normalizeError(context, error, method) {

        if (error && error.isTelegramError) {
            return error;
        }

        const response = (error && error.response) || {};
        let body = response.data;

        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) { /* keep the raw string */ }
        }

        const status = (body && body.error_code) || response.status;
        const description = (body && body.description) || (typeof body === 'string' ? body : '');

        const hints = {
            400: 'Bad request (400).',
            401: 'Authentication failed (401). The bot token is invalid or was revoked - re-issue it with @BotFather.',
            403: 'Forbidden (403). The bot is not a member of the chat, was blocked by the user, or lacks the required admin right.',
            404: 'Not found (404). The Bot API method or the resource does not exist.',
            409: 'Conflict (409). Another process is polling this bot with getUpdates, or a different webhook is registered.',
            429: 'Rate limit exceeded (429).'
        };

        const message = [`Telegram ${method} failed.`, hints[status], description]
            .filter(Boolean)
            .join(' ');

        const cancelError = new context.CancelError(message);

        cancelError.isTelegramError = true;
        cancelError.status = status;

        // Seconds to wait before retrying, per Telegram's flood control.
        if (status === 429 && body && body.parameters) {
            cancelError.retryAfter = body.parameters.retry_after;
        }

        return cancelError;
    },

    /**
     * Drop null/undefined/empty-string values so optional inspector fields left blank are
     * not sent as empty strings - Telegram rejects several of those with a 400.
     * @param {object} source
     * @returns {object}
     */
    clean(source = {}) {

        return Object.entries(source).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});
    },

    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log('info', 'File was saved', { fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title, ...schemaWithoutTitle } = schema;
                    res.push({ label: title, value: field, schema: schemaWithoutTitle });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);

            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

/**
 * Order-insensitive comparison of two string lists (Telegram echoes allowed_updates back
 * in its own order).
 * @param {Array<string>} a
 * @param {Array<string>} b
 * @returns {boolean}
 */
const sameSet = (a, b) => {

    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false;
    }

    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((item, index) => item === sortedB[index]);
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {

    if (!array.length) {
        return '';
    }

    const headers = Object.keys(array[0]);

    return [
        headers.join(','),
        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};
