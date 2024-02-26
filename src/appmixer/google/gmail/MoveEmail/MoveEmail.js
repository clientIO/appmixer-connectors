'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {
    async receive(context) {
        const {
            emailId,
            destinationFolder,
            folder
        } = context.messages.in.content;
        const modifyLabel = promisify(gmail.users.messages.modify.bind(gmail.users.messages.modify));
        const email = await modifyLabel({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            resource: {
                addLabelIds: [destinationFolder],
                removeLabelIds: [folder]
            },
            id: emailId,
        });
        return context.sendJson(email, 'out');
    },
};
