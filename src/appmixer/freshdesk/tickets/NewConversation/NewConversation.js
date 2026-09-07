'use strict';
const { apiCall, normalizeMultiselectInput } = require('../../lib');

async function fetchConversations(context, ticketId) {
    const res = await apiCall(context, {
        url: `/tickets/${ticketId}/conversations`,
        params: { per_page: 100 }
    });
    return Array.isArray(res.data) ? res.data : [];
}

async function fetchFullTicket(context, ticketId) {
    const res = await apiCall(context, { url: `/tickets/${ticketId}` });
    return res.data;
}

// Whether a conversation should be emitted given the component's include/ignore filters.
// Shared by tick() and test() so both honor the exact same filtering.
function isIncludedConversation(conv, includeTypes, ignoredAgentIds) {
    const type = conv.private === true ? 'notes' : 'conversations';
    if (!includeTypes.includes(type)) return false;
    if (ignoredAgentIds.length > 0 && ignoredAgentIds.includes(conv.user_id)) return false;
    return true;
}

// Build the trigger output object. Single source of truth for the output shape, shared by
// tick() and test().
function toConversationEvent(conv, conversations, ticket) {
    return {
        conversation: conv,
        conversationType: conv.private === true ? 'note' : 'reply',
        conversationsList: conversations,
        ticket
    };
}

function getFilters(context) {
    const { ignoreAgents, include } = context.properties;
    return {
        ignoredAgentIds: ignoreAgents
            ? normalizeMultiselectInput(ignoreAgents, context, 'Ignore agents').map(Number)
            : [],
        includeTypes: include
            ? normalizeMultiselectInput(include, context, 'Include')
            : ['conversations', 'notes']
    };
}

module.exports = {

    async tick(context) {

        const { ignoredAgentIds, includeTypes } = getFilters(context);

        const state = context.state || {};
        const lookbackMs = 2 * 60 * 1000;

        // flowStartedAt: set once on the very first tick. Any conversation created after this
        // timestamp on a ticket we're seeing for the first time is treated as new.
        const flowStartedAt = state.flowStartedAt || new Date().toISOString();
        const isFirstRun = !state.flowStartedAt;

        // knownMaxConvId: { [ticketId]: number } — highest conversation id seen per ticket
        const knownMaxConvId = state.knownMaxConvId || {};
        const newKnownMaxConvId = { ...knownMaxConvId };

        // Step 1: use updated_since to get only recently-updated tickets.
        // A ticket's updated_at bumps when a new conversation is added, so this is precise.
        const cursorUpdatedAt = state.cursorUpdatedAt
            ? new Date(state.cursorUpdatedAt)
            : new Date(Date.now() - lookbackMs);

        const from = new Date(cursorUpdatedAt.getTime() - lookbackMs).toISOString();

        const params = new URLSearchParams({
            updated_since: from,
            order_by: 'updated_at',
            order_type: 'asc',
            per_page: '100'
        });

        let nextUrl = `/tickets?${params.toString()}`;
        let maxUpdatedAt = state.cursorUpdatedAt || null;
        let maxTicketId = state.cursorTicketId || 0;

        const updatedTickets = [];

        while (nextUrl) {
            const res = await apiCall(context, { url: nextUrl });
            const tickets = res.data || [];

            for (const ticket of tickets) {
                const updatedAt = ticket.updated_at;
                const ticketId = ticket.id;

                const isAfterCursor =
                    !state.cursorUpdatedAt ||
                    updatedAt > state.cursorUpdatedAt ||
                    (updatedAt === state.cursorUpdatedAt && ticketId > (state.cursorTicketId || 0));

                if (isAfterCursor) {
                    updatedTickets.push(ticket);

                    if (
                        !maxUpdatedAt ||
                        updatedAt > maxUpdatedAt ||
                        (updatedAt === maxUpdatedAt && ticketId > maxTicketId)
                    ) {
                        maxUpdatedAt = updatedAt;
                        maxTicketId = ticketId;
                    }
                }
            }

            const match = (res.headers.link || '').match(/<([^>]+)>;\s*rel="next"/);
            nextUrl = match ? match[1] : null;
        }

        // Step 2: for each recently-updated ticket, fetch conversations and detect new ones
        for (const ticket of updatedTickets) {
            const ticketId = ticket.id;

            let conversations;
            try {
                conversations = await fetchConversations(context, ticketId);
            } catch (err) {
                continue;
            }

            const prevMaxId = knownMaxConvId[ticketId] != null ? knownMaxConvId[ticketId] : null;
            let newMaxId = prevMaxId;

            // Track the highest conv id seen this tick for this ticket
            for (const conv of conversations) {
                if (newMaxId === null || conv.id > newMaxId) {
                    newMaxId = conv.id;
                }
            }

            // Determine which conversations are "new":
            // - If we've seen this ticket before: any conv with id > prevMaxId
            // - If first encounter: any conv created after flowStartedAt (catches the case where
            //   the user adds a conversation right after starting the flow, before the first tick
            //   had a chance to record baseline state for this ticket)
            const isNewConv = (conv) => {
                if (prevMaxId !== null) {
                    return conv.id > prevMaxId;
                }
                // First encounter — only emit conversations created after the flow started
                return conv.created_at >= flowStartedAt;
            };

            // On the very first run ever, just record state without emitting anything —
            // we have no baseline to compare against and don't want to flood with old data.
            if (isFirstRun) {
                newKnownMaxConvId[ticketId] = newMaxId;
                continue;
            }

            // Fetch full ticket for output (lazy, only if we'll actually emit)
            let fullTicket = ticket;
            let fetchedFullTicket = false;

            for (const conv of conversations) {
                if (!isNewConv(conv)) continue;
                if (!isIncludedConversation(conv, includeTypes, ignoredAgentIds)) continue;

                if (!fetchedFullTicket) {
                    try {
                        fullTicket = await fetchFullTicket(context, ticketId);
                    } catch (err) {
                        // fallback to summary
                    }
                    fetchedFullTicket = true;
                }

                await context.sendJson(toConversationEvent(conv, conversations, fullTicket), 'out');
            }

            newKnownMaxConvId[ticketId] = newMaxId;
        }

        await context.saveState({
            flowStartedAt,
            cursorUpdatedAt: maxUpdatedAt || state.cursorUpdatedAt,
            cursorTicketId: maxTicketId,
            knownMaxConvId: newKnownMaxConvId
        });
    },

    // Flow Test Mode: emit one realistic conversation event without starting the flow.
    // Reuses the same fetch/filter/shape helpers as tick(): grabs the most recently updated
    // ticket, picks its newest conversation matching the filters, and emits it. No state touched.
    async test(context) {

        const { ignoredAgentIds, includeTypes } = getFilters(context);

        const listRes = await apiCall(context, {
            url: '/tickets?order_by=updated_at&order_type=desc&per_page=1'
        });
        const ticketSummary = (listRes.data || [])[0];
        if (!ticketSummary) {
            throw new Error('No tickets to use as test data.');
        }

        const conversations = await fetchConversations(context, ticketSummary.id);
        const conv = conversations
            .filter(c => isIncludedConversation(c, includeTypes, ignoredAgentIds))
            .sort((a, b) => b.id - a.id)[0];

        if (!conv) {
            throw new Error('No recent conversations to use as test data.');
        }

        const fullTicket = await fetchFullTicket(context, ticketSummary.id);

        await context.sendJson(toConversationEvent(conv, conversations, fullTicket), 'out');
    }
};
