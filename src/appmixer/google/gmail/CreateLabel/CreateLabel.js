'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const gmail = GoogleApi.gmail('v1');

module.exports = {

    receive(context) {

        const createLabel = Promise.promisify(gmail.users.labels.create, { context: gmail.users.labels });

        return createLabel({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            resource: context.messages.in.content
        }).then(result => {
            return context.sendJson(result, 'label');
        });
    }
};
