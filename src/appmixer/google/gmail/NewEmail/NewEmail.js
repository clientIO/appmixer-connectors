'use strict';
const commons = require('../../google-commons');
const GoogleApi = commons.GoogleApi;
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');
const getMessage = Promise.promisify(gmail.users.messages.get, { context: gmail.users.messages });

/**
 * Trigger for GMail when new email appears.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let newState = {};
        let auth = commons.getOauth2Client(context.auth);
        let { userId } = context.auth;

        const { labels: { AND: labels } = { AND: [] } } = context.properties;

        const isLabelsEmpty = !labels.some(label => label.name);

        const data = await commons.listNewMessages({ auth, userId: 'me', quotaUser: userId },
            context.state.id || null);

        // latest message or there are no messages in the inbox
        newState.id = data.lastMessageId;
        const emails = await Promise.map(data.newMessages, message => {
            return getMessage({
                auth,
                userId: 'me',
                quotaUser: userId,
                format: 'full',
                id: message.id
            });
        }, { concurrency: 10 });

        await Promise.each(emails || [], async email => {
            if (!email.labelIds) {
                await context.sendError('Invalid email label, ' + JSON.stringify(email));
            }
            if (isLabelsEmpty || labels.some(label => email.labelIds.includes(label.name))) {
                if (commons.isNewInboxEmail(email.labelIds)) {
                    await context.sendJson(commons.normalizeEmail(email), 'out');
                }
            }          
        });

        return context.saveState(newState);
    }
};
