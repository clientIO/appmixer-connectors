'use strict';
const lib = require('../../lib');

/**
 * Returns the current UTC time as an ISO 8601 string without milliseconds
 * (YYYY-MM-DDTHH:MM:SSZ) — the format required by the GitHub Notifications API `since` parameter.
 * @returns {string}
 */
function nowIso() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Maximum number of notification IDs to retain in context.state.known.
 * Acts as a safety cap: getNewItems() already replaces known with the current
 * tick's IDs on every run (not a union), so in practice this only matters if
 * a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

/**
 * Optional comma-separated `owner/repo` list → lowercase Set, or null when unset.
 * @param {string} [repositories]
 * @returns {Set<string>|null}
 */
function parseRepoFilter(repositories) {

    return repositories
        ? new Set(repositories.split(',').map(r => r.trim().toLowerCase()).filter(Boolean))
        : null;
}

/**
 * Keep only notifications whose reason is `mention`, optionally restricted to the
 * given repositories (case-insensitive match on `repository.full_name`).
 * @param {Array<Object>} notifications
 * @param {Set<string>|null} repoFilter
 * @returns {Array<Object>}
 */
function filterMentions(notifications, repoFilter) {

    return notifications.filter(n => {
        if (n.reason !== 'mention') return false;
        if (repoFilter) {
            const fullName = (n.repository && n.repository.full_name || '').toLowerCase();
            if (!repoFilter.has(fullName)) return false;
        }
        return true;
    });
}

/**
 * Component which triggers whenever the authenticated user is mentioned on GitHub.
 * Uses the GitHub Notifications API filtering by reason=mention.
 * @extends {Component}
 */
module.exports = {

    async start(context) {
        // Record the flow start time so the first tick only picks up mentions
        // that arrive AFTER the flow was started.
        if (!context.state.since) {
            await context.saveState({ since: nowIso(), known: [] });
        }
    },

    async tick(context) {

        const repoFilter = parseRepoFilter(context.properties.repositories);

        // Snapshot the next window's lower bound BEFORE issuing the request. Any mention
        // that arrives while we page through the results is >= nextSince, so it is picked
        // up on the following tick instead of being skipped by an advanced `since`.
        const nextSince = nowIso();

        // since — server-side date filter: only notifications updated after the flow started.
        // GitHub expects YYYY-MM-DDTHH:MM:SSZ (no milliseconds). /notifications is paginated,
        // so fetch every page to avoid missing mentions when >100 notifications updated in the window.
        const notifications = await lib.apiRequestPaginated(context, 'notifications', {
            params: { all: true, since: context.state.since }
        });

        const mentions = filterMentions(notifications, repoFilter);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, mentions, 'id');

        if (diff.length) {
            await Promise.all(diff.map(notification => context.sendJson(notification, 'out')));
        }

        // Advance the since window (snapshotted before the fetch) so the next tick only fetches
        // what's new. Trim known to MAX_KNOWN as a defensive cap (getNewItems already replaces —
        // not accumulates — the set each tick, but we guard against unexpectedly large pages).
        const trimmedKnown = actual.length > MAX_KNOWN ? actual.slice(actual.length - MAX_KNOWN) : actual;
        await context.saveState({ known: trimmedKnown, since: nextSince });
    },

    async test(context) {

        const repoFilter = parseRepoFilter(context.properties.repositories);

        // Notifications come newest-first; the most recent page is enough to find a mention.
        const res = await lib.apiRequest(context, 'notifications', { params: { all: true } });
        const [mention] = filterMentions(res.data, repoFilter);
        if (!mention) {
            throw new Error('No recent mention notifications to use as test data.');
        }
        return context.sendJson(mention, 'out');
    }
};
