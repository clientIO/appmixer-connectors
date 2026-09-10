'use strict';

const lib = require('../../lib');

/**
 * Maximum number of comment IDs to retain in context.state.known.
 * The set accumulates (see lib.mergeKnownIds) because GitHub's `since` filters on
 * last-updated: an edited old comment re-enters the window and must not re-fire.
 */
const MAX_KNOWN = 500;

/**
 * The PR number is the last segment of `pull_request_url`
 * (https://api.github.com/repos/{owner}/{repo}/pulls/{number}).
 * @param {Object} comment
 * @returns {String}
 */
function pullRequestNumberOf(comment) {
    return (comment.pull_request_url || '').split('/').pop();
}

/**
 * Add the pull request number to the emitted comment, the way NewReview does.
 *
 * The raw payload carries only `pull_request_url`, yet ReplyToReviewComment and
 * CreateReviewComment both take `pullRequestNumber` as a required input — so without
 * this the obvious flow (react to a review comment, answer in its thread) would have to
 * slice the number out of a URL in a lambda.
 *
 * @param {Object} comment
 * @returns {Object}
 */
function withPullRequestNumber(comment) {

    const number = parseInt(pullRequestNumberOf(comment), 10);
    return { ...comment, pull_request_number: Number.isFinite(number) ? number : null };
}

/**
 * Apply the trigger's optional filters. None of them can be pushed to the server:
 * the review-comments endpoint has no author parameter, and the search API that does
 * is eventually consistent, which makes it the wrong tool for a trigger.
 * @param {Array<Object>} comments
 * @param {Object} properties
 * @returns {Array<Object>}
 */
function filterComments(comments, { pullRequestNumber, author, authorType }) {

    const wantedPr = pullRequestNumber ? String(pullRequestNumber).trim() : '';

    return comments.filter(comment => {
        if (wantedPr && pullRequestNumberOf(comment) !== wantedPr) return false;
        if (!lib.matchesAuthor(comment.user?.login, author)) return false;
        if (!lib.matchesAuthorType(comment.user, authorType)) return false;
        return true;
    });
}

/**
 * Fetch one page of the repository's review comments, newest-updated first.
 *
 * Deliberately a single page rather than lib.apiRequestPaginated(): paging this
 * endpoint is unreliable on busy repositories (GitHub answers 502). The `since`
 * window plus the stored known-ID set make one page sufficient.
 * @param {Object} context
 * @param {String} repositoryId
 * @param {String} [since]
 * @returns {Promise<Array<Object>>}
 */
async function fetchPage(context, repositoryId, since) {

    const params = { sort: 'updated', direction: 'desc' };
    if (since) params.since = since;

    const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls/comments`, { params });
    return Array.isArray(data) ? data : [];
}

/**
 * Component which triggers whenever a new review comment — a comment anchored to a
 * line of a pull request diff — is posted anywhere in a repository.
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
            await Promise.all(fresh.map(comment => context.sendJson(withPullRequestNumber(comment), 'out')));
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
            throw new Error('No recent pull request review comments to use as test data.');
        }
        return context.sendJson(withPullRequestNumber(comment), 'out');
    }
};
