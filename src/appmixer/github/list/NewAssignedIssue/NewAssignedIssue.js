'use strict';
const lib = require('../../lib');

/**
 * Maximum number of IDs to retain in context.state.known.
 * getNewItems() replaces (not accumulates) known each tick, so this cap only
 * fires if a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

/**
 * Login of the authenticated user, cached in the component state after the
 * first lookup. The repository issues endpoint filters by an explicit login
 * (`assignee=<login>`); the `@me` shorthand is rejected with 422 there.
 * @param {Object} context
 * @returns {Promise<string>}
 */
async function resolveLogin(context) {

    if (context.state && context.state.login) {
        return context.state.login;
    }
    const { data } = await lib.apiRequest(context, 'user');
    if (context.saveState) {
        await context.saveState({ ...context.state, login: data.login });
    }
    return data.login;
}

/**
 * Endpoint + query parameters listing the open issues assigned to the
 * authenticated user, either in one repository or across all of them.
 * @param {Object} context
 * @param {string} [repositoryId] owner/repo
 * @returns {Promise<{ action: string, params: Object }>}
 */
async function assignedIssuesRequest(context, repositoryId) {

    if (repositoryId) {
        // GET /repos/{owner}/{repo}/issues?assignee={login}&state=open
        const login = await resolveLogin(context);
        return { action: `repos/${repositoryId}/issues`, params: { assignee: login, state: 'open' } };
    }
    // GET /issues?filter=assigned — every issue assigned to the authenticated user.
    return { action: 'issues', params: { filter: 'assigned', state: 'open' } };
}

/**
 * Both `GET /issues` and `GET /repos/{owner}/{repo}/issues` return pull requests
 * alongside issues (PRs carry a `pull_request` field). This trigger fires only for
 * issues, so PRs are filtered out before diffing/emitting.
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 */
function excludePullRequests(items) {

    return (items || []).filter(item => !item.pull_request);
}

/**
 * Component which triggers whenever a new issue is assigned to the authenticated user.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { repositoryId } = context.properties;
        const { action, params } = await assignedIssuesRequest(context, repositoryId);

        const res = await lib.apiRequest(context, action, { params });
        const issues = excludePullRequests(res.data);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, issues, 'id');

        if (diff.length) {
            await Promise.all(diff.map(issue => context.sendJson(issue, 'out')));
        }
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ ...context.state, known: trimmedKnown });
    },

    async test(context) {

        const { repositoryId } = context.properties;
        const { action, params } = await assignedIssuesRequest(context, repositoryId);

        const res = await lib.apiRequest(context, action, {
            params: { ...params, sort: 'created', direction: 'desc' }
        });
        // Same PR filtering as tick() so Flow Test Mode never emits a pull request.
        const [issue] = excludePullRequests(res.data);
        if (!issue) {
            throw new Error('No open issues assigned to you to use as test data.');
        }
        return context.sendJson(issue, 'out');
    }
};
