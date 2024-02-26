'use strict';
const gmail = require('googleapis').gmail('v1');
const google = require('../../google-commons');
const Promise = require('bluebird');

const getEmail = Promise.promisify(gmail.users.messages.get, { context: gmail.users.messages });

/**
 * Trigger for GMail when new starred email appears.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        let newState = {};

        return google.getAllMessageIds({
            auth: google.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            labelIds: ['STARRED']
        }).then(messages => {
            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
            let current = [];
            let diff = [];

            // process all messages given by the service
            messages.forEach(
                context.utils.processItem.bind(
                    null, known, current, diff, message => message.id));

            newState = { known: current };
            return Promise.map(diff, message => {
                return getEmail({
                    auth: google.getOauth2Client(context.auth),
                    userId: 'me',
                    quotaUser: context.auth.userId,
                    format: 'full',
                    id: message.id
                });
            }, { concurrency: 10 });
        }).then(emails => {
            return Promise.map(emails || [], email => {
                return context.sendJson(google.normalizeEmail(email), 'out');
            });
        }).then(() => {
            return context.saveState(newState);
        });
    }
};
