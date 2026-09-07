'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { contactId } = context.messages.in.content;

        await apiCall(context, {
            method: 'DELETE',
            url: `/contacts/${contactId}`
        });

        return context.sendJson({ contactId }, 'out');
    }
};
