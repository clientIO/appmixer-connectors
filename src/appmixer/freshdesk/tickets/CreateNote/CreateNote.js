'use strict';
const { apiCall, trimUndefined } = require('../../lib');

module.exports = {

    async receive(context) {

        if ([undefined, null, ''].includes(context.messages.in.content.ticketId)) {
            throw new context.CancelError('Ticket ID is required!');
        }
        if (!context.messages.in.content.body) {
            throw new context.CancelError('Body is required!');
        }

        const { content } = context.messages.in;

        const body = trimUndefined({
            body: content.body,
            user_id: content.agentId,
            private: content.private !== undefined ? content.private : true,
            notify_emails: content.notifyEmails ? content.notifyEmails.split(',').map(e => e.trim()) : undefined
        });

        const { data } = await apiCall(context, {
            method: 'POST',
            url: `/tickets/${content.ticketId}/notes`,
            data: body
        });

        return context.sendJson({
            id: data.id,
            ticketId: data.ticket_id,
            body: data.body,
            bodyText: data.body_text,
            agentId: data.user_id,
            private: data.private,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'newNote');
    }
};
