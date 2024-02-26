'use strict';
const Webflow = require('webflow-api');
const TRIGGER_TYPE = 'form_submission';
const Promise = require('bluebird');

/**
 * Component trigger, which fires when the form is submitted from your Webflow site.
 * @extends {Component}
 */
module.exports = {

    registerWebhook(client, webhookId, siteId, webhookCallbackUrl) {

        return this.unregisterWebhook(client, webhookId, siteId)
            .then(() => {
                return client.createWebhook({
                    siteId,
                    triggerType: TRIGGER_TYPE,
                    url: webhookCallbackUrl
                });
            });
    },

    unregisterWebhook(client, webhookId, siteId) {

        if (!webhookId) {
            return Promise.resolve();
        }

        return client.removeWebhook({ siteId, webhookId });
    },

    start(context) {

        let {
            state: { webhookId },
            properties: { siteId },
            auth: { apiKey }
        } = context;

        const client = new Webflow({ token: apiKey });
        return this.registerWebhook(client, webhookId, siteId, context.getWebhookUrl())
            .then(response => {
                return context.saveState({ webhookId: response._id });
            });
    },

    stop(context) {

        let {
            state: { webhookId },
            properties: { siteId },
            auth: { apiKey }
        } = context;

        const client = new Webflow({ token: apiKey });
        return this.unregisterWebhook(client, webhookId, siteId);
    },

    async receive(context) {

        let { data } = context.messages.webhook.content;

        if (context.properties.form && data.name !== context.properties.form) {
            // the webhook is not for the form we're watching
            return context.response();
        }
        await context.sendJson(data, 'out');
        return context.response();
    }
};

