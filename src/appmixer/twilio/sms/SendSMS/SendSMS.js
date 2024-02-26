'use strict';
const twilio = require('twilio');

module.exports = {

    receive(context) {

        let { accountSID, authenticationToken } = context.auth;
        let client = twilio(accountSID, authenticationToken);
        let message = context.messages.message.content;

        return client.messages.create({
            body: message.body,
            to: message.to,
            from: message.from
        }).then(message => {
            return context.sendJson(message, 'sent');
        });
    }
};
