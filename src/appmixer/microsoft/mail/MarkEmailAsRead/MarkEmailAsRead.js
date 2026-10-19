'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.emailId) {
            throw new context.CancelError('Message ID is required!');
        }

        const { emailId } = context.messages.in.content;
        const { data: result } = await makeRequest(context, {
            path: `/me/messages/${emailId}`,
            method: 'PATCH',
            data: {
                isRead: true
            }
        });
        return context.sendJson({ result }, 'out');
    }
};

