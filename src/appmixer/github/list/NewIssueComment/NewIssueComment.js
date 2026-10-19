'use strict';

const lib = require('../../lib');

/**
 * Maximum number of comment IDs to retain in context.state.known.
 * The set accumulates (see lib.mergeKnownIds) because GitHub's `since` filters on
 * last-updated: an edited old comment re-enters the window and must not re-fire.
 */
const MAX_KNOWN = 500;

/**
 * Apply the trigger's filters.
 *
 * `commentOn` cannot be pushed to the server: the repo-wide endpoint returns comments
 * on issues and on pull requests with nothing in the payload to tell them apart
 * (`issue_url` says `/issues/` for both), so lib.isPullRequestComment() reads it off
 * `html_url` instead.
 * @param {Array<Object>} comments
 * @param {Object} properties
 * @returns {Array<Object>}
 */
function filterComments(comments, { commentOn = 'both', author, authorType }) {

    return comments.filter(comment => {
        if (commentOn === 'pull_requests' && !lib.isPullRequestComment(comment)) return false;
        if (commentOn === 'issues' && lib.isPullRequestComment(comment)) return false;
        if (!lib.matchesAuthor(comment.user?.login, author)) return false;
        if (!lib.matchesAuthorType(comment.user, authorType)) return false;
        return true;
    });
}

/**
 * Fetch one page of the repository's issue comments, newest-updated first.
 * @param {Object} context
 * @param {String} repositoryId
 * @param {String} [since]
 * @returns {Promise<Array<Object>>}
 */
async function fetchPage(context, repositoryId, since) {

    const params = { sort: 'updated', direction: 'desc' };
    if (since) params.since = since;

    const { data } = await lib.apiRequest(context, `repos/${repositoryId}/issues/comments`, { params });
    return Array.isArray(data) ? data : [];
}

/**
 * Component which triggers whenever a new conversation comment is posted on an issue
 * or a pull request anywhere in a repository.
 * @extends {Component}
 */
module.exports = {

    async start(context) {
        // Record the flow start time so the first tick only picks up comments
        // posted AFTER the flow was started.
        if (!context.state.since) {
            await context.saveState({ since: lib.nowIso(), known: [] });
        }
    },

    async tick(context) {

        const { repositoryId } = context.properties;

        // Snapshot the next window's lower bound BEFORE issuing the request, so a comment
        // posted while the request is in flight is picked up on the following tick instead
        // of being skipped by an already-advanced `since`.
        const nextSince = lib.nowIso();

        const page = await fetchPage(context, repositoryId, context.state.since);

        const known = new Set(context.state.known || []);
        const fresh = filterComments(page, context.properties)
            .filter(comment => !known.has(String(comment.id)));

        if (fresh.length) {
            await Promise.all(fresh.map(comment => context.sendJson({
                ...comment,
                // The API leaves this implicit; the flow should not have to parse html_url.
                is_pull_request: lib.isPullRequestComment(comment)
            }, 'out')));
        }

        // Remember every ID on the page, not just the emitted ones — a comment that the
        // filters rejected must not be reconsidered when it is edited later.
        await context.saveState({
            since: nextSince,
            known: lib.mergeKnownIds(context.state.known, page.map(comment => comment.id), MAX_KNOWN)
        });
    },

    async test(context) {

        const { repositoryId } = context.properties;

        const page = await fetchPage(context, repositoryId);
        const [comment] = filterComments(page, context.properties);
        if (!comment) {
            throw new Error('No recent issue or pull request comments to use as test data.');
        }
        return context.sendJson({
            ...comment,
            is_pull_request: lib.isPullRequestComment(comment)
        }, 'out');
    }
};
