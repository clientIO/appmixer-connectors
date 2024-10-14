'use strict';
const commons = require('../../calendly-commons');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new event is created.
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
     * When webhook is triggered by Calendly check the data and if it's a member list
     * change, send it to output port.
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {

        let data = context.messages.webhook.content.data;
        if (!data) {
            return;
        }
        await Promise.map([data], data => {
            data.payload.event['assigned_to'] = data.payload.event['assigned_to'].join(', ');
            return context.sendJson(data, 'event');
        });
        return context.response();
    },

    /**
     * Register webhook in Calendly API.
     * @param {Context} context
     * @return {Promise}
     */
    registerWebhook(context) {

        let url = context.getWebhookUrl();

        return this.unregisterWebhook(context)
            .then(() => {
                return commons.registerWebhookSubscription(context.auth.accessToken, 'invitee.created', url);
            }).then(response => {
                return context.saveState({ webhookId: response.id });
            });
    },

    /**
     * Delete registered webhook. If there is no webhookId in state, do nothing.
     * @param {Context} context
     * @return {Promise}
     */
    unregisterWebhook(context) {

        let webhookId = context.state.webhookId;
        if (!webhookId) {
            return Promise.resolve();
        }

        return commons.removeWebhookSubscription(webhookId, context.auth.accessToken);
    }
};
