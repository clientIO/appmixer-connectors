'use strict';
const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { ticketId } = context.messages.in.content;

        await apiCall(context, {
            method: 'DELETE',
            url: `/tickets/${ticketId}`
        });

        return context.sendJson({ ticketId }, 'ticketId');
    }
};
