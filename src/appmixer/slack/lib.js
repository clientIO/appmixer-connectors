/* eslint-disable camelcase */
'use strict';

const pathModule = require('path');
const Entities = require('html-entities').AllHtmlEntities;
const { WebClient } = require('@slack/web-api');
const { createHmac } = require('node:crypto');
// TODO: Uncomment when https://github.com/clientIO/appmixer-core/issues/2889 is fixed
// const slackConnectorVersion = require('./bundle.json').version;

module.exports = {
    /**
     * Normalize multiselect input (array or string) to comma-separated string for Slack API.
     * @param {string|string[]} input
     * @param {number} maxItems
     * @param {object} context
     * @param {string} fieldName
     * @returns {string}
     */
    normalizeMultiselectInput(input, maxItems = 8, context, fieldName) {
        if (Array.isArray(input)) {
            if (input.length > maxItems) {
                throw new context.CancelError(`You can send a message to a maximum of ${maxItems} users at once`);
            }
            return input.join(',');
        } else if (typeof input === 'string') {
            return input;
        } else {
            throw new context.CancelError(`${fieldName} must be a string or an array`);
        }
    },

    /**
     * Thread inputs of Send*ChannelMessage. The inputs were renamed to camelCase
     * (threadTs, replyBroadcast) in 5.5.1; flows saved earlier still carry the
     * original Slack names (thread_ts, reply_broadcast), so both are honoured.
     * @param {Object} content
     * @returns {{ threadTs: string|undefined, replyBroadcast: boolean|undefined }}
     */
    getThreadInputs(content = {}) {

        const threadTs = content.threadTs ?? content.thread_ts;
        const replyBroadcast = content.replyBroadcast ?? content.reply_broadcast;
        return { threadTs, replyBroadcast };
    },

    /**
     * Send slack channel message.
     * @param {Object} context
     * @param {string} channelId
     * @param {string} message
     * @param {boolean} asBot
     * @param {string} thread_ts
     * @param {boolean} reply_broadcast
     * @param {Object} options
     * @return {Promise<*>}
     */
    async sendMessage(context, channelId, message, asBot = false, thread_ts, reply_broadcast, options = {}) {

        let token = context.auth?.accessToken;

        // iconUrl and username are only for bot messages.
    	let iconUrl = options.iconUrl;
    	let username = options.username;
        if (asBot === true) {
            // Make sure the bot token is used.
            // Backward compatibility - 4.1.3 uses config.botToken
            // 4.1.4+ uses context.auth.profileInfo.botToken
            token = context.auth?.profileInfo?.botToken || context.config?.botToken;
            if (!token && !context.config?.usesAuthHub) {
                throw new context.CancelError('Bot token is required for sending messages as bot. Please provide it in the connector configuration.');
            }
        }

        let entities = new Entities();

        if (context.config?.usesAuthHub && asBot) {
            // Send into AuthHub route
            const authHubUrl = process.env.AUTH_HUB_URL + '/plugins/appmixer/slack/auth-hub/send-message';
            const { data } = await context.httpRequest({
                url: authHubUrl,
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.AUTH_HUB_TOKEN}`
                    // 'x-appmixer-version-slack': slackConnectorVersion
                },
                data: {
                    iconUrl,
                    username,
                    channelId,
                    text: entities.decode(message),
                    ...options.blocks ? { blocks: options.blocks } : {},
                    token,
                    ...(thread_ts ? { thread_ts } : {}),
                    ...(typeof reply_broadcast === 'boolean' ? { reply_broadcast } : {})
                }
            });

            return data;
        }

        const web = new WebClient(token);

        // Auth token or Bot token is set. AuthHub is not used.
        // Directly send as bot.
        const response = await web.chat.postMessage({
            icon_url: iconUrl,
            username,
            channel: channelId,
            text: entities.decode(message),
            ...(options.blocks ? { blocks: options.blocks } : {}),
            ...(thread_ts ? { thread_ts } : {}),
            ...(typeof reply_broadcast === 'boolean' ? { reply_broadcast } : {})
        });

        return response.message;
    },

    // Expects standardized outputType: 'first', 'object', 'array', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'first', records = [] }) {

        if (outputType === 'first') {
            // First item found only.
            await context.sendJson(records[0], outputPortName);
        } else if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once. The array field is `records` (not the canonical `result`)
            // to stay compatible with flows and dropdown transformers that already read it.
            await context.sendJson({ records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(records[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'slack-lists'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Emit the variable-picker options of a dynamic out port for the given outputType.
     * `itemSchema` is `ITEM_SCHEMA.properties` of the calling component, so the options
     * cannot drift from the exported contract. The array wrapper field stays `records`
     * (see sendArrayOutput).
     * @param {Object} context
     * @param {string} outputType
     * @param {Object} itemSchema
     * @param {{ label?: string, outputPortName?: string }} [options]
     */
    getOutputPortOptions(context, outputType, itemSchema, { label, outputPortName = 'out' } = {}) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema).map(field => {
                const { title: fieldLabel, ...schemaWithoutTitle } = itemSchema[field];
                return { label: fieldLabel, value: field, schema: schemaWithoutTitle };
            });
            return context.sendJson(options, outputPortName);
        }

        if (outputType === 'array') {
            return context.sendJson([
                {
                    label: label || 'Records',
                    value: 'records',
                    schema: {
                        type: 'array',
                        items: { type: 'object', properties: itemSchema }
                    }
                },
                { label: 'Items Count', value: 'count', schema: { type: 'integer', example: 1 } }
            ], outputPortName);
        }

        if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id', example: '6a95493889a78ab01364b817' } }
            ], outputPortName);
        }

        return context.sendJson([], outputPortName);
    },

    isValidPayload(context, req) {

        // Validates the payload with the Slack-signature hash
        const slackSignature = req.headers['x-slack-signature'];
        const signingSecret = context.config?.signingSecret;
        if (!signingSecret) {
            context.log('error', 'slack-plugin-route-webhook-event-missing-signingSecret');
            return false;
        }

        // Handle two types of payload:
        // 1. Buffer (raw body, as in /interactions)
        // 2. Object (already parsed)
        let payloadString;
        if (Buffer.isBuffer(req.payload)) {
            // Raw buffer, convert to string
            payloadString = req.payload.toString('utf8');
        } else if (typeof req.payload === 'string') {
            // Already a string
            payloadString = req.payload;
        } else {
            // Fallback: JSON stringified object
            payloadString = JSON.stringify(req.payload)
                .replace(/\//g, '\\/')
                .replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
        }

        const timestamp = req.headers['x-slack-request-timestamp'];
        const baseString = `v0:${timestamp}:${payloadString}`;
        const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');

        if (slackSignature !== mySignature) {
            context.log('info', 'slack-plugin-route-webhook-event-invalid-signature', { config: context.config });
            context.log('error', 'slack-plugin-route-webhook-event-invalid-signature', { slackSignature, mySignature, baseString, payloadString });
            return false;
        }
        return true;
    }
};
