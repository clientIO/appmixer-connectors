'use strict';
const { apiCall } = require('../../lib');

function mapDeletedTicket(ticket) {
    return {
        id: ticket.id,
        subject: ticket.subject,
        deleted_at: ticket.updated_at,
        ticketJson: ticket
    };
}

// Shared by tick() and test(): fetch one page of deleted tickets, keep only the ones actually
// flagged `deleted`, and map them to the trigger output shape. Centralizes the request, the
// deleted-filter and the pagination parsing so tick() and test() stay in sync.
async function requestDeletedTickets(context, urlOrParams) {

    const url = typeof urlOrParams === 'string'
        ? urlOrParams
        : `/tickets?${urlOrParams.toString()}`;

    const res = await apiCall(context, { url });
    const records = (res.data || []).filter(ticket => ticket.deleted).map(mapDeletedTicket);
    const match = (res.headers.link || '').match(/<([^>]+)>;\s*rel="next"/);

    return { records, nextUrl: match ? match[1] : null };
}

module.exports = {

    async tick(context) {

        const state = context.state || {};
        const lookbackMs = 2 * 60 * 1000;

        // Deleted tickets API supports updated_since too (filter=deleted)
        const cursorUpdatedAt = state.cursorUpdatedAt
            ? new Date(state.cursorUpdatedAt)
            : new Date(Date.now() - lookbackMs);

        const from = new Date(cursorUpdatedAt.getTime() - lookbackMs).toISOString();

        const isFirstRun = !state.cursorUpdatedAt;

        const params = new URLSearchParams({
            filter: 'deleted',
            updated_since: from,
            order_by: 'updated_at',
            order_type: 'asc',
            per_page: '100'
        });

        let nextUrl = params;
        let maxUpdatedAt = state.cursorUpdatedAt || null;
        let maxTicketId = state.cursorTicketId || 0;

        while (nextUrl) {
            const { records, nextUrl: next } = await requestDeletedTickets(context, nextUrl);

            for (const fields of records) {
                const updatedAt = fields.deleted_at;
                const ticketId = fields.id;

                // On the first run, skip emission entirely (baseline-only behavior).
                const isAfterCursor =
                    !isFirstRun && (
                        updatedAt > state.cursorUpdatedAt ||
                        (updatedAt === state.cursorUpdatedAt && ticketId > (state.cursorTicketId || 0))
                    );

                if (!isAfterCursor) continue;

                await context.sendJson(fields, 'ticket');

                if (
                    !maxUpdatedAt ||
                    updatedAt > maxUpdatedAt ||
                    (updatedAt === maxUpdatedAt && ticketId > maxTicketId)
                ) {
                    maxUpdatedAt = updatedAt;
                    maxTicketId = ticketId;
                }
            }

            nextUrl = next;
        }

        // Always persist cursor even when no results, to prevent gaps if polling interval exceeds lookback window.
        const cursorToSave = maxUpdatedAt || cursorUpdatedAt.toISOString();
        await context.saveState({ cursorUpdatedAt: cursorToSave, cursorTicketId: maxTicketId });
    },

    // Flow Test Mode: emit one realistic deleted ticket without starting the flow.
    // Reuses requestDeletedTickets() — only the query differs (most recently deleted first,
    // single page) and no cursor/state is touched.
    async test(context) {

        const params = new URLSearchParams({
            filter: 'deleted',
            order_by: 'updated_at',
            order_type: 'desc',
            per_page: '1'
        });

        const { records } = await requestDeletedTickets(context, params);

        if (!records.length) {
            throw new Error('No recent deleted tickets to use as test data.');
        }

        await context.sendJson(records[0], 'ticket');
    }
};
