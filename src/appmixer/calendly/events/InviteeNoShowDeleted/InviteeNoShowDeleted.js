'use strict';
const commons = require('../../calendly-commons');

/**
 * @extends {Component}
 */
module.exports = {

    start(context) {

        return this.registerWebhook(context);
    },

    stop(context) {

        return this.unregisterWebhook(context);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {

        if (context.messages.webhook) {
            const { data: webhookData } = context.messages.webhook.content;
            context.log({ step: 'webhookData received', webhookData });

            if (webhookData) {
                await context.sendJson(webhookData, 'out');
            }

            return context.response();
        }
    },

    /**
     * Register webhook in Calendly API.
     * @param {Context} context
     * @return {Promise}
     */
    async registerWebhook(context) {
        await this.unregisterWebhook(context);
        const response = await commons.registerWebhookSubscription(context, 'invitee_no_show.deleted');
        return context.saveState({ webhookUri: response.uri });
    },

    /**
     * Delete registered webhook. If there is no webhookUri in state, do nothing.
     * @param {Context} context
     * @return {Promise}
     */
    unregisterWebhook(context) {

        let webhookUri = context.state.webhookId;
        if (!webhookUri) {
            return;
        }

        return commons.removeWebhookSubscription(webhookUri, context);
    }
};
