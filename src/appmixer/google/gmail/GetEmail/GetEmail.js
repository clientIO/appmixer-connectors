'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {

    async receive(context) {

        const { emailId } = context.messages.in.content;
        const getEmail = promisify(gmail.users.messages.get.bind(gmail.users.messages.get));
        const email = await getEmail({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            format: 'full',
            id: emailId
        });
        return context.sendJson(commons.normalizeEmail(email), 'out');
    }
};
