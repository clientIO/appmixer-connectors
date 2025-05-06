/* eslint-disable camelcase */
'use strict';

const pathModule = require('path');
const Entities = require('html-entities').AllHtmlEntities;
const { WebClient } = require('@slack/web-api');
// TODO: Uncomment when https://github.com/clientIO/appmixer-core/issues/2889 is fixed
// const slackConnectorVersion = require('./bundle.json').version;

module.exports = {

    /**
     * Send slack channel message.
     * @param {string} channelId
     * @param {string} message
     * @param {boolean} asBot
     * @param {string} thread_ts
     * @param {boolean} reply_broadcast
     * @return {Promise<*>}
     */
    async sendMessage(context, channelId, message, asBot = false, thread_ts, reply_broadcast) {

        let token = context.auth.accessToken;

        // Only for bot messages.
        let iconUrl;
        let username;
        if (asBot === true) {
            // Make sure the bot token is used.
            token = context.config?.botToken;
            if (!token && !context.config?.usesAuthHub) {
                throw new context.CancelError('Bot token is required for sending messages as bot. Please provide it in the connector configuration.');
            }

            ({ iconUrl, username } = context.messages.message.content);
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
            ...(thread_ts ? { thread_ts } : {}),
            ...(typeof reply_broadcast === 'boolean' ? { reply_broadcast } : {})
        });

        return response.message;
    },

    // TODO: Move to appmixer-lib
    // Expects standardized outputType: 'item', 'items', 'file', 'first'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'first', records = [] }) {

        if (outputType === 'first') {
            // First item found only.
            await context.sendJson(records[0], outputPortName);
        } else if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ records }, outputPortName);
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
    }
};
