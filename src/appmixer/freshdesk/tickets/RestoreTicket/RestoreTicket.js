'use strict';
const axios = require('axios');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const { ticketId } = context.messages.in.content;

        const url = `https://${auth.domain}.freshdesk.com/api/v2/tickets/${ticketId}/restore`;
        await axios.put(url, {}, {
            auth: {
                username: auth.apiKey,
                password: 'X'
            }
        });

        return context.sendJson({ ticketId }, 'ticketId');
    }
};
