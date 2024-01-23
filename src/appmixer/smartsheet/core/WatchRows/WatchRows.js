'use strict';

const lib = require('../../lib');

module.exports = {

    async start(context) {

        try {
            // Register a new webhook for watching new row creation
            const { result } = await this.registerWebhook(context, '*.*');
            await context.saveState({ webhookId: result.id });
        } catch (error) {
            throw new Error('Failed to start. ' + error.message);
        }
    },

    async stop(context) {

        try {
            // Unregister the webhook when stopping the watch
            await this.unregisterWebhook(context);
        } catch (error) {
            throw new Error('Failed to stop. ' + error.message);
        }
    },

    async receive(context) {

        const { challenge, events } = context.messages.webhook?.content?.data || {};

        if (challenge) {
            // Respond to the challenge to validate the webhook
            return context.response({ smartsheetHookResponse: challenge }, 200);
        }

        if (events) {
            for (const event of events) {
                if (event.objectType === 'row') {
                    const data = await this.httpRequest(context, 'GET', `/sheets/${context.properties.sheetId}/rows/${event.id}`);
                    await context.sendJson(data, 'out');
                };
            }
            return context.response({});
        }
    },

    async registerWebhook(context, event) {

        const webhookUrl = context.getWebhookUrl();
        const sheetId = +(context.properties.sheetId);

        const data = await this.httpRequest(context, 'POST', '/webhooks', {
            callbackUrl: webhookUrl,
            name: `SmartSheet Watch Rows - ${sheetId}`,
            events: [event],
            scopeObjectId: sheetId,
            scope: 'sheet',
            version: 1

        });


        if (data['message'] === 'SUCCESS') {

            await this.httpRequest(context, 'PUT', `/webhooks/${data.result.id}`, {
                enabled: true
            });
            return data;
        } else {
            throw new Error('Failed to register webhook. ' + data.message);
        }
    },

    async unregisterWebhook(context) {

        const webhookId = context.state.webhookId;

        if (webhookId) {
            await this.httpRequest(context, 'DELETE', `/webhooks/${webhookId}`);
        }
    },

    async httpRequest(context, method, path, requestBody) {

        // Use the existing httpRequest function from the provided code
        const url = lib.getBaseUrl(context) + path;
        const headers = { 'Authorization': 'Bearer ' + context.auth.accessToken };
        const req = { url, method, headers, data: requestBody };
        try {
            const response = await context.httpRequest(req);
            return response.data;
        } catch (error) {
            throw new Error('HTTP request failed. ' + error.message);
        }
    }
};
