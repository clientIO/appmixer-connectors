'use strict';
const commons = require('../../google-commons');
const emailCommons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { emailId } = context.messages.in.content;
        const endpoint = `/users/me/messages/${emailId}`;
        const emailDetails = await emailCommons.callEndpoint(context, endpoint, {
            method: 'GET',
            params: {
                format: 'full'
            },
            headers: { 'Content-Type': 'application/json' }
        });

        const normalizedEmail = commons.normalizeEmail(emailDetails.data);
        return context.sendJson(normalizedEmail, 'out');
    }
};
