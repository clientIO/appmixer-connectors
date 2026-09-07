'use strict';
const { normalizeMultiselectInput, requestTickets } = require('../../lib');

function getNormalizedEmbed(context) {
    const { embed } = context.properties;
    return embed ? normalizeMultiselectInput(embed, context, 'Embed fields') : [];
}

module.exports = {

    async tick(context) {

        const normalizedEmbed = getNormalizedEmbed(context);

        const state = context.state || {};
        const lookbackMs = 2 * 60 * 1000;

        const cursorUpdatedAt = state.cursorUpdatedAt
            ? new Date(state.cursorUpdatedAt)
            : new Date(Date.now() - lookbackMs);

        // Start slightly before the cursor to avoid missing boundary updates
        const from = new Date(cursorUpdatedAt.getTime() - lookbackMs).toISOString();

        const params = new URLSearchParams({
            updated_since: from,
            order_by: 'updated_at',
            order_type: 'asc',
            per_page: '100'
        });
        if (normalizedEmbed.length > 0) {
            params.set('include', normalizedEmbed.join(','));
        }

        const isFirstRun = !state.cursorUpdatedAt;

        let nextUrl = params;
        let maxUpdatedAt = state.cursorUpdatedAt || null;
        let maxTicketId = state.cursorTicketId || 0;

        while (nextUrl) {
            const { records, nextUrl: next } = await requestTickets(context, nextUrl, normalizedEmbed);

            for (const fields of records) {
                const updatedAt = fields.updatedAt;
                const ticketId = fields.id;

                // Strict cursor check with tie-breaker on id.
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

    // Flow Test Mode: emit one realistic ticket without starting the flow.
    // Reuses the same requestTickets()/mapTicket() path as tick() — the only difference
    // is the query (most recently updated first, single page) and that no cursor/state is touched.
    async test(context) {

        const normalizedEmbed = getNormalizedEmbed(context);

        const params = new URLSearchParams({
            order_by: 'updated_at',
            order_type: 'desc',
            per_page: '1'
        });
        if (normalizedEmbed.length > 0) {
            params.set('include', normalizedEmbed.join(','));
        }

        const { records } = await requestTickets(context, params, normalizedEmbed);

        if (!records.length) {
            throw new Error('No recent tickets to use as test data.');
        }

        await context.sendJson(records[0], 'ticket');
    }
};
