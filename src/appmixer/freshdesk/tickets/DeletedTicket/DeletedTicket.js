'use strict';
const axios = require('axios');

module.exports = {
    async tick(context) {
        const { auth } = context;
        let since = new Date();
        let deletedTickets = [];

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
                per_page: perPage,
                filter: 'deleted',
                order_by: 'updated_at',
                order_type: 'desc'
            }
        };

        let tickets = [];

        for (let i = 1; i <= pages; i++) {
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
            if (ticket.deleted && updatedAt > sinceToCompare) {
                deletedTickets.push({
                    id: ticket.id,
                    subject: ticket.subject,
                    deleted_at: ticket.updated_at
                });
            }
        });

        if (deletedTickets.length) {
            deletedTickets.forEach(ticket => {
                context.sendJson(ticket, 'ticket');
            });
        }
        await context.saveState({ since });
    }
};
