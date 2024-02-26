'use strict';

module.exports = {

    async receive(context) {

        const {
            operation,
            allAtOnce = true,
            embedFields = []
        } = context.properties;

        /*
            Since it's not possible to pass string constants to the static call, numbers are used instead to
            determine the operation:
            - 1: Generate output port for ListTickets
            - 2: Generate output port for GetTicket
            - 3: Generate output port for NewTicket and UpdatedTicket
         */

        if (operation === 2) {
            return context.sendJson({ embedFields }, 'out');
        }
        if (operation === 3) {
            return context.sendJson({ embedFields }, 'out');
        }
        return context.sendJson({ allAtOnce }, 'out');
    },

    getTicketComponentOutput({ embedFields: embed }) {

        const fields = [
            { label: 'Ticket ID', value: 'id' },
            { label: 'CreatedAt', value: 'createdAt' },
            { label: 'Due By', value: 'dueBy' },
            { label: 'Subject', value: 'subject' },
            { label: 'Description', value: 'description' },
            { label: 'Requester ID', value: 'requesterId' },
            { label: 'Type', value: 'type' },
            { label: 'Status', value: 'status' },
            { label: 'Priority', value: 'priority' },
            { label: 'Assigned Agent ID', value: 'agentId' },
            { label: 'Ticket JSON', value: 'ticketJson' }
        ];

        if (embed.includes('conversations')) {
            fields.push({ label: 'Conversations', value: 'conversations' });
        }

        if (embed.includes('requester')) {
            fields.push({ label: 'Requester name', value: 'requesterName' });
            fields.push({ label: 'Requester email', value: 'requesterEmail' });
        }

        if (embed.includes('company')) {
            fields.push({ label: 'Company', value: 'company' });
        }

        if (embed.includes('stats')) {
            fields.push({ label: 'Stats', value: 'stats' });
        }

        return fields;
    },

    triggerOutputOptions({ embedFields: embed }) {

        const fields = [
            { label: 'Ticket ID', value: 'id' },
            { label: 'CreatedAt', value: 'createdAt' },
            { label: 'Due By', value: 'dueBy' },
            { label: 'Subject', value: 'subject' },
            { label: 'Type', value: 'type' },
            { label: 'Status', value: 'status' },
            { label: 'Priority', value: 'priority' },
            { label: 'Assigned Agent ID', value: 'agentId' },
            { label: 'Ticket JSON', value: 'ticketJson' }
        ];

        if (embed.includes('requester')) {
            fields.push({ label: 'Requester ID', value: 'requesterId' });
            fields.push({ label: 'Requester name', value: 'requesterName' });
            fields.push({ label: 'Requester email', value: 'requesterEmail' });
        }

        if (embed.includes('description')) {
            fields.push({ label: 'Description', value: 'description' });
        }

        return fields;
    },

    getOutputOptions({ allAtOnce }) {
        let output = [];
        if (allAtOnce) {
            output.push({ label: 'Tickets', value: 'tickets' });
        } else {
            output = output.concat([
                { label: 'Ticket ID', value: 'id' },
                { label: 'CreatedAt', value: 'createdAt' },
                { label: 'Due By', value: 'dueBy' },
                { label: 'Subject', value: 'subject' },
                { label: 'Type', value: 'type' },
                { label: 'Status', value: 'status' },
                { label: 'Priority', value: 'priority' },
                { label: 'Assigned Agent ID', value: 'agentId' },
                { label: 'Ticket JSON', value: 'ticketJson' }
            ]);
        }
        return output;
    }
};
