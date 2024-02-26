'use strict';
const axios = require('axios');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        const { auth } = context;
        const { embed = [] } = context.properties;

        let since = new Date();
        let updated = new Set();

        const limit = 100;
        const perPage = 100;
        const pages = Math.ceil(limit / perPage);

        const url = `https://${auth.domain}.freshdesk.com/api/v2/tickets`;
        const requestObject = {
            auth: {
                username: auth.apiKey,
                password: 'X'
            },
            params: {
                per_page: 100,
                order_by: 'updated_at',
                include: 'requester,description'
            }
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

        const sinceToCompare = context.state.since || since;

        tickets.forEach(ticket => {
            const updatedAt = new Date(ticket.updated_at);
            if (updatedAt > sinceToCompare) {
                updated.add(ticket);
            }
        });

        if (updated.size) {
            await Promise.map(updated, ticket => {
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

        await context.saveState({ since });
    }
};
