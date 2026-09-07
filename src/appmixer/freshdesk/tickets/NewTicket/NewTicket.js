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

        // Cursor is based on created_at — we only want genuinely new tickets.
        // initialCursorCreatedAt is used as the fallback state so that on the first tick
        // where no new tickets are found, we still persist a cursor and avoid re-emitting
        // updated (but not new) tickets on subsequent ticks.
        const initialCursorCreatedAt = new Date(Date.now() - lookbackMs).toISOString();
        const cursorCreatedAt = state.cursorCreatedAt
            ? new Date(state.cursorCreatedAt)
            : new Date(initialCursorCreatedAt);

        // Use updated_since slightly before the cursor (new tickets have updated_at === created_at)
        const from = new Date(cursorCreatedAt.getTime() - lookbackMs).toISOString();

        const params = new URLSearchParams({
            updated_since: from,
            order_by: 'created_at',
            order_type: 'asc',
            per_page: '100'
        });
        if (normalizedEmbed.length > 0) {
            params.set('include', normalizedEmbed.join(','));
        }

        const isFirstRun = !state.cursorCreatedAt;

        let nextUrl = params;
        let maxCreatedAt = state.cursorCreatedAt || initialCursorCreatedAt;
        let maxTicketId = state.cursorTicketId || 0;

        while (nextUrl) {
            const { records, nextUrl: next } = await requestTickets(context, nextUrl, normalizedEmbed);

            for (const fields of records) {
                const createdAt = fields.createdAt;
                const ticketId = fields.id;

                // Only emit tickets created after the cursor (tie-break on id)
                // On the first run, skip emission entirely (baseline-only behavior)
                const isNew =
                    !isFirstRun && (
                        createdAt > state.cursorCreatedAt ||
                        (createdAt === state.cursorCreatedAt && ticketId > (state.cursorTicketId || 0))
                    );

                if (!isNew) continue;

                await context.sendJson(fields, 'ticket');

                if (
                    !maxCreatedAt ||
                    createdAt > maxCreatedAt ||
                    (createdAt === maxCreatedAt && ticketId > maxTicketId)
                ) {
                    maxCreatedAt = createdAt;
                    maxTicketId = ticketId;
                }
            }

            nextUrl = next;
        }

        await context.saveState({ cursorCreatedAt: maxCreatedAt, cursorTicketId: maxTicketId });
    },

    // Flow Test Mode: emit one realistic ticket without starting the flow.
    // Reuses the same requestTickets()/mapTicket() path as tick() — the only difference
    // is the query (newest first, single page) and that no cursor/state is touched.
    async test(context) {

        const normalizedEmbed = getNormalizedEmbed(context);

        const params = new URLSearchParams({
            order_by: 'created_at',
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
