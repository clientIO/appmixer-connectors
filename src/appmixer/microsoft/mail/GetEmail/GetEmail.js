'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.messageId) {
            throw new context.CancelError('Message ID is required!');
        }

        const { messageId } = context.messages.in.content;
        const { data: result } = await makeRequest(context, {
            path: `/me/messages/${messageId}`,
            method: 'GET'
        });
        return context.sendJson(result, 'out');
    }
};

