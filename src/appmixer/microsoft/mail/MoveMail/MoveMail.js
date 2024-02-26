'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { destinationFolder } = context.messages.in.content;
        const { emailId } = context.messages.in.content;
        const { data: result } = await makeRequest(context, {
            path: `/me/messages/${emailId}/move`,
            method: 'POST',
            data: {
                destinationId: destinationFolder
            }
        });
        return context.sendJson({ result }, 'out');
    }
};

