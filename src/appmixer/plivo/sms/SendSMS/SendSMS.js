'use strict';
const Plivo = require('plivo');

/**
 * Component for sending SMS text messages through Plivo.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        // Get Auth ID and Auth Token https://console.plivo.com/dashboard/
        let { fromNumber } = context.properties;
        let { accountSID, authenticationToken } = context.auth;
        let { body, to } = context.messages.message.content;
        let client = new Plivo.Client(accountSID, authenticationToken);

        return client.messages.create(fromNumber, to, body)
            .then(message => {
                message.messageUuid = Array.isArray(message.messageUuid) ? message.messageUuid[0] : message.messageUuid;
                return context.sendJson(message, 'sent');
            });
    }
};
