'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { emailId, categories } = context.messages.in.content;
        const { data } = await makeRequest(context, {
            path: `/me/messages/${emailId}`,
            method: 'PATCH',
            data: {
                categories
            }
        });
        return context.sendJson({ result: data }, 'out');
    }
};

