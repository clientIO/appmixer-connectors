'use strict';
const lib = require('../../lib');

/**
 * Maximum number of IDs to retain in context.state.known.
 * getNewItems() replaces (not accumulates) known each tick, so this cap only
 * fires if a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

/**
 * Endpoint + query parameters listing the open issues assigned to the
 * authenticated user, either in one repository or across all of them.
 * @param {string} [repositoryId] owner/repo
 * @returns {{ action: string, params: Object }}
 */
function assignedIssuesRequest(repositoryId) {

    if (repositoryId) {
        // GET /repos/{owner}/{repo}/issues?assignee=@me&state=open
        return { action: `repos/${repositoryId}/issues`, params: { assignee: '@me', state: 'open' } };
    }
    // GET /issues?filter=assigned — every issue assigned to the authenticated user.
    return { action: 'issues', params: { filter: 'assigned', state: 'open' } };
}

/**
 * Component which triggers whenever a new issue is assigned to the authenticated user.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { repositoryId } = context.properties;
        const { action, params } = assignedIssuesRequest(repositoryId);

        const res = await lib.apiRequest(context, action, { params });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, res.data, 'id');

        if (diff.length) {
            await Promise.all(diff.map(issue => context.sendJson(issue, 'out')));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown });
    },

    async test(context) {

        const { repositoryId } = context.properties;
        const { action, params } = assignedIssuesRequest(repositoryId);

        const issue = await lib.fetchLatest(context, action, {
            params: { ...params, sort: 'created', direction: 'desc' }
        });
        if (!issue) {
            throw new Error('No open issues assigned to you to use as test data.');
        }
        return context.sendJson(issue, 'out');
    }
};
