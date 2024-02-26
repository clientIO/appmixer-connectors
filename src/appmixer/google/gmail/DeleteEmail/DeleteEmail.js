'use strict';
const commons = require('../../google-commons');
const GoogleApi = commons.GoogleApi;
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {

    receive(context) {

        const deleteEmail = Promise.promisify(
            context.messages.in.content.permanently ?
                gmail.users.messages.delete :
                gmail.users.messages.trash,
            { context: gmail.users.messages });

        return deleteEmail({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            id: context.messages.in.content.emailId
        }).then(result => {
            return context.sendJson(result, 'deleted');
        });
    }
};
