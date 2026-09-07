'use strict';
const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { ticketId } = context.messages.in.content;

        await apiCall(context, {
            method: 'PUT',
            url: `/tickets/${ticketId}/restore`,
            data: {}
        });

        return context.sendJson({ ticketId }, 'ticketId');
    }
};
