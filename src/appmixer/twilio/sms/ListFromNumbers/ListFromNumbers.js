'use strict';
const twilio = require('twilio');

module.exports = {

    receive(context) {

        let { accountSID, authenticationToken } = context.auth;
        let client = twilio(accountSID, authenticationToken);
        return client.incomingPhoneNumbers.list()
            .then(res => {
                return context.sendJson(res, 'numbers');
            });
    }
};

