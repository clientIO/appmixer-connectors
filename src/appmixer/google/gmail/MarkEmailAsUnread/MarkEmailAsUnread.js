'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const { emailId } = context.messages.in.content;
        const endpoint = `/users/me/messages/${emailId}/modify`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                addLabelIds: ['UNREAD']
            }
        };
        const response = await commons.callEndpoint(context, endpoint, options);
        return context.sendJson(response.data, 'out');
    }
};
