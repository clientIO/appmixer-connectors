'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { messageId } = context.messages.in.content;
        const { data: result } = await makeRequest(context, {
            path: `/me/messages/${messageId}`,
            method: 'GET'
        });
        return context.sendJson(result, 'out');
    }
};

