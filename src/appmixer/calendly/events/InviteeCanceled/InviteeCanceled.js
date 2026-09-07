'use strict';
const commons = require('../../calendly-commons');

/**
 * Component which triggers whenever an event is canceled.
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

    // Flow Test Mode: emit one realistic invitee.canceled payload without registering a webhook.
    // Reuses the connector-level helpers shared by every Calendly webhook trigger.
    async test(context) {
        const invitee = await commons.fetchLatestExample(context, { status: 'canceled' });
        if (!invitee) {
            throw new Error('No recent canceled invitees to use as test data.');
        }
        return context.sendJson(commons.toWebhookShape(context, invitee, 'invitee.canceled'), 'out');
    },

    /**
     * Register webhook in Calendly API.
     * @param {Context} context
     * @return {Promise}
     */
    async registerWebhook(context) {
        await this.unregisterWebhook(context);
        const response = await commons.registerWebhookSubscription(context, 'invitee.canceled');
        return context.saveState({ webhookUri: response.uri });
    },

    /**
     * Delete registered webhook. If there is no webhookUri in state, do nothing.
     * @param {Context} context
     * @return {Promise}
     */
    unregisterWebhook(context) {

        const { webhookUri } = context.state;
        if (!webhookUri) {
            return;
        }

        return commons.removeWebhookSubscription(webhookUri, context);
    }
};
