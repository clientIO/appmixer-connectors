'use strict';
const commons = require('../lib');

module.exports = {
    async receive(context) {
        const { emailId } = context.messages.in.content;
        const endpoint = `/users/me/messages/${emailId}/modify`;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            data: {
                removeLabelIds: ['UNREAD']
            }
        };
        const response = await commons.callEndpoint(context, endpoint, options);
        return context.sendJson(response.data, 'out');
    }
};
