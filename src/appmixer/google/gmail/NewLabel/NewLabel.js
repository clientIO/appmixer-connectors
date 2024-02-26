'use strict';
const gmail = require('googleapis').gmail('v1');
const google = require('../../google-commons');
const Promise = require('bluebird');

/**
 * Component which triggers whenever new label is added to the gmail.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const listLabels = Promise.promisify(gmail.users.labels.list, { context: gmail.users.labels });
        const newLabel = Promise.promisify(gmail.users.labels.get, { context: gmail.users.labels });

        return listLabels({
            auth: google.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId
        }).then(res => {
            let labels = res['labels'];
            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
            let current = [];
            let diff = [];

            labels.forEach(
                context.utils.processItem.bind(
                    null, known, current, diff, label => label.id));

            context.state = { known: Array.from(current) };

            return Promise.map(diff, label => {
                return newLabel({
                    auth: google.getOauth2Client(context.auth),
                    userId: 'me',
                    quotaUser: context.auth.userId,
                    id: label.id
                });
            }, { concurrency: 10 });
        }).then(labels => {
            return Promise.map(labels, label => {
                return context.sendJson(label, 'out');
            });
        });
    }
};
