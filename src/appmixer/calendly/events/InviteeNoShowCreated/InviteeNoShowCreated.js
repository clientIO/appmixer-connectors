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

    // Flow Test Mode: emit one realistic invitee_no_show.created payload without registering
    // a webhook. Finds a recent invitee marked as no-show and reshapes it into the no-show
    // webhook body via the shared connector-level helpers.
    async test(context) {
        const invitee = await commons.fetchLatestExample(context, { find: i => !!i.no_show });
        if (!invitee) {
            throw new Error('No recent invitees marked as no-show to use as test data.');
        }
        return context.sendJson(
            commons.toNoShowWebhookShape(context, invitee, 'invitee_no_show.created'), 'out');
    },

    /**
     * Register webhook in Calendly API.
     * @param {Context} context
     * @return {Promise}
     */
    async registerWebhook(context) {
        await this.unregisterWebhook(context);
        const response = await commons.registerWebhookSubscription(context, 'invitee_no_show.created');
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
