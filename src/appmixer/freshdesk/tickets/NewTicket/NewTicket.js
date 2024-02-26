'use strict';
const axios = require('axios');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        const { auth } = context;
        const { embed = [] } = context.properties;

        let since = (new Date()).toISOString();

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        const limit = 100;
        const perPage = 100;
        const pages = Math.ceil(limit / perPage);

        const params = { per_page: perPage };
        if (embed.length > 0) {
            params.include = embed.join(',');
        }

        const url = `https://${auth.domain}.freshdesk.com/api/v2/tickets`;

        const requestObject = {
            auth: {
                username: auth.apiKey,
                password: 'X'
            },
            params
        };

        let tickets = [];

        for (let i = 1; i <= pages; i++ ) {
            requestObject.params.page = i;
            const { data } = await axios.get(url, requestObject);
            if (data.length === 0) {
                break;
            }
            tickets = tickets.concat(data);
        }

        tickets = tickets.slice(0, limit);

        tickets.forEach(ticket => {
            if (known && !known.has(ticket['id'])) {
                diff.add(ticket);
            }
            actual.add(ticket['id']);
        });

        if (diff.size) {
            await Promise.map(diff, ticket => {
                const fields = {
                    id: ticket.id,
                    created_at: ticket.created_at,
                    due_by: ticket.due_by,
                    subject: ticket.subject,
                    type: ticket.type,
                    status: ticket.status,
                    priority: ticket.priority,
                    agentId: ticket.responder_id,
                    ticketJson: ticket
                };

                if (embed.includes('requester')) {
                    fields.requesterId = ticket.requester.id;
                    fields.requesterName = ticket.requester.name;
                    fields.requesterEmail = ticket.requester.email;
                }

                if (embed.includes('description')) {
                    fields.description = ticket.description_text;
                }

                return context.sendJson(fields, 'ticket');
            });
        }

        await context.saveState({ known: Array.from(actual), since });
    }
};
