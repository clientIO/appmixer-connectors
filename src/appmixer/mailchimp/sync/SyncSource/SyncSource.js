'use strict';
const commons = require('../../mailchimp-commons');
const Promise = require('bluebird');

/**
 * Component has two functions. On start it get all the members of a specified mailchimp
 * list. All these members are sent to it's output port. After all members are sent, it
 * registers webhook to get all change information on that list.
 */
module.exports = {

    /**
     * Get all list members on start.
     * @param {Context} context
     * @return {Promise.<T>}
     */
    start(context) {

        let { listId } = context.properties;
        let memberStatus = context.properties.status;
        let { metadata: { dc }, accessToken } = context.auth;
        let qs = {};

        /*
        TODO uncomment as part of GRID-908
        if (memberStatus && memberStatus !== 'all') {
            qs.status = memberStatus;
        }
        */
        qs.status = 'subscribed';

        return commons.getMembers({ listId, dc, accessToken, qs })
            .then(members => {

                members.forEach(member => {
                    context.sendJson({ phase: 'init', source: 'mailchimp', data: member }, 'member');
                });

                context.sendJson({ phase: 'init-done', source: 'mailchimp' }, 'member');
                return this.registerWebhook(context);
            });
    },

    /**
     * Delete mailchimp webhook on stop.
     * @param {Context} context
     * @return {*|Promise}
     */
    stop(context) {

        return this.unregisterWebhook(context);
    },

    /**
     * Register mailchimp webhook on reload.
     * @param {Context} context
     * @return {*|Promise}
     */
    reload(context) {

        return this.registerWebhook(context);
    },

    /**
     * When webhook is triggered by Mailchimp check the data and if it's a member list
     * change, send it to output port.
     * @param {Context} context
     * @return {*}
     */
    receive(context) {

        let data = context.messages.webhook.content.data;

        // when webhook is registered, GET with relationID is received, that is not
        // important to us in this case
        if (!data.type) {
            return;
        }

        if (data.type === 'unsubscribe') {
            return;
        }

        if (data.type === 'subscribe') {
            data = data.data;
            data['merge_fields'] = data.merges;
            data['email_address'] = data.email;
            context.sendJson({
                phase: 'increment',
                source: 'mailchimp',
                data: data
            }, 'member');
        }
    },

    /**
     * Register webhook in Mailchimp API.
     * @param {Context} context
     * @return {Promise}
     */
    registerWebhook(context) {

        let dc = context.auth.metadata.dc;
        let listId = context.properties.listId;
        let url = context.getWebhookUrl();
        let accessToken = context.auth.accessToken;

        return this.unregisterWebhook(context)
            .then(() => {
                return mailchimpDriver.lists.createWebhook({
                    dc: dc,
                    listId: listId,
                    auth: { accessToken },
                    json: {
                        url: url,
                        events: {
                            subscribe: true,
                            unsubscribe: true,
                            cleaned: true,
                            profile: true,
                            upemail: true,
                            campaign: false
                        },
                        sources: {
                            user: true,
                            admin: true,
                            api: false
                        }
                    }
                });
            }).then(response => {
                context.state = {
                    webhookId: response.id
                };
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

        let dc = context.auth.metadata.dc;
        let accessToken = context.auth.accessToken;
        let listId = context.properties.listId;

        return mailchimpDriver.lists.deleteWebhook({
            dc: dc,
            listId: listId,
            webhookId: webhookId,
            auth: { accessToken }
        });
    }
};
