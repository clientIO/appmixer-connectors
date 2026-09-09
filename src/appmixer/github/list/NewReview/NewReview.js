'use strict';

const lib = require('../../lib');

/**
 * Maximum number of review IDs to retain in context.state.known.
 */
const MAX_KNOWN = 500;

/**
 * How many pull requests a single tick will look at. GitHub has no repository-wide
 * reviews endpoint (`/repos/{owner}/{repo}/pulls/reviews` is a 404), so reviews can only
 * be reached one pull request at a time. Bounding the fan-out keeps a busy repository
 * from exhausting the connector's request quota on every tick.
 */
const MAX_PULL_REQUESTS = 30;

/**
 * A review that was never submitted has no `submitted_at` and state `PENDING` — it is a
 * draft only its author can see, so it is not an event.
 * @param {Object} review
 * @returns {Boolean}
 */
function isSubmitted(review) {
    return !!review.submitted_at && review.state !== 'PENDING';
}

/**
 * Apply the trigger's filters to the reviews of one pull request.
 * @param {Array<Object>} reviews
 * @param {Object} properties
 * @param {String} since ISO 8601 lower bound on `submitted_at`
 * @returns {Array<Object>}
 */
function filterReviews(reviews, { state = 'any', author, authorType }, since) {

    return reviews.filter(review => {
        if (!isSubmitted(review)) return false;
        if (since && review.submitted_at < since) return false;
        if (state !== 'any' && review.state !== state) return false;
        if (!lib.matchesAuthor(review.user?.login, author)) return false;
        if (!lib.matchesAuthorType(review.user, authorType)) return false;
        return true;
    });
}

/**
 * The pull requests a tick should inspect: the one the trigger is pinned to, or the open
 * ones touched since the last tick (submitting a review bumps the pull request's
 * `updated_at`), newest first and capped at MAX_PULL_REQUESTS.
 * @param {Object} context
 * @param {String} repositoryId
 * @param {String} [pullRequestNumber]
 * @param {String} [since]
 * @returns {Promise<Array<Number|String>>}
 */
async function pullRequestsToScan(context, repositoryId, pullRequestNumber, since) {

    if (pullRequestNumber) {
        return [String(pullRequestNumber).trim()];
    }

    const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls`, {
        params: { state: 'open', sort: 'updated', direction: 'desc' }
    });

    const pullRequests = Array.isArray(data) ? data : [];
    return pullRequests
        .filter(pullRequest => !since || pullRequest.updated_at >= since)
        .slice(0, MAX_PULL_REQUESTS)
        .map(pullRequest => pullRequest.number);
}

/**
 * Add the pull request number to the emitted review — a review payload carries only
 * `pull_request_url`, and a flow should not have to parse it.
 * @param {Object} review
 * @param {Number|String} number
 * @returns {Object}
 */
function withPullRequestNumber(review, number) {
    return { ...review, pull_request_number: Number(number) };
}

/**
 * Component which triggers whenever a pull request review is submitted — approved,
 * changes requested or commented.
 * @extends {Component}
 */
module.exports = {

    async start(context) {
        // Record the flow start time so the first tick only picks up reviews
        // submitted AFTER the flow was started.
        if (!context.state.since) {
            await context.saveState({ since: lib.nowIso(), known: [] });
        }
    },

    async tick(context) {

        const { repositoryId, pullRequestNumber } = context.properties;

        // Snapshot the next window's lower bound BEFORE issuing any request, so a review
        // submitted while the fan-out is in flight is picked up on the following tick.
        const nextSince = lib.nowIso();
        const since = context.state.since;

        const numbers = await pullRequestsToScan(context, repositoryId, pullRequestNumber, since);

        const known = new Set(context.state.known || []);
        const seenIds = [];
        const fresh = [];

        for (const number of numbers) {
            const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls/${number}/reviews`);
            const reviews = Array.isArray(data) ? data : [];

            reviews.filter(isSubmitted).forEach(review => seenIds.push(review.id));

            filterReviews(reviews, context.properties, since)
                .filter(review => !known.has(String(review.id)))
                .forEach(review => fresh.push(withPullRequestNumber(review, number)));
        }

        if (fresh.length) {
            await Promise.all(fresh.map(review => context.sendJson(review, 'out')));
        }

        await context.saveState({
            since: nextSince,
            known: lib.mergeKnownIds(context.state.known, seenIds, MAX_KNOWN)
        });
    },

    async test(context) {

        const { repositoryId, pullRequestNumber } = context.properties;

        // No `since` here: Flow Test Mode wants the most recent representative review,
        // however old it is.
        const numbers = await pullRequestsToScan(context, repositoryId, pullRequestNumber);

        // Only the handful of most recently touched pull requests — one request each, and
        // a repository whose ten newest pull requests have no matching review will not
        // have one further down either.
        for (const number of numbers.slice(0, 10)) {
            const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls/${number}/reviews`);
            const matching = filterReviews(Array.isArray(data) ? data : [], context.properties);
            if (matching.length) {
                // Reviews come oldest-first; the last one is the most recent.
                const review = matching[matching.length - 1];
                return context.sendJson(withPullRequestNumber(review, number), 'out');
            }
        }

        throw new Error('No recent pull request reviews to use as test data.');
    }
};
