'use strict';
const axios = require('axios');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const { ticketId, embed = [] } = context.messages.in.content;

        const requestObject = {
            auth: {
                username: auth.apiKey,
                password: 'X'
            }
        };

        if (embed && embed.length > 0) {
            requestObject.params = { include: embed.join(',') };
        }

        const url = `https://${auth.domain}.freshdesk.com/api/v2/tickets/${ticketId}`;
        const { data } = await axios.get(url, requestObject);

        const fields = {
            id: data.id,
            created_at: data.created_at,
            due_by: data.due_by,
            subject: data.subject,
            description: data.description_text,
            requester_id: data.requester_id,
            type: data.type,
            status: data.status,
            priority: data.priority,
            agentId: data.responder_id,
            ticketJson: data
        };

        if (embed.includes('conversations')) {
            fields.conversations = data.conversations;
        }

        if (embed.includes('requester')) {
            fields.requester_name = data.requester.name;
            fields.requester_email = data.requester.email;
        }

        if (embed.includes('company')) {
            fields.company = data.company;
        }

        if (embed.includes('stats')) {
            fields.stats = data.stats;
        }

        return context.sendJson(fields, 'ticket');
    }
};
