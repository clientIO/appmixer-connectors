'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const gmail = GoogleApi.gmail('v1');

module.exports = {

    receive(context) {

        const deleteLabel = Promise.promisify(gmail.users.labels.delete, { context: gmail.users.messages });

        return deleteLabel({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            id: context.messages.in.content.labelId
        }).then(() => {
            return context.sendJson({ id: context.messages.in.content.labelId }, 'deleted');
        });
    }
};
