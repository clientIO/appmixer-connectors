'use strict';
const lib = require('../../lib');

/**
 * Process issues to find newly created. The issues.get-for-repo Github API endpoint
 * returns pull requests as well, but we do not care about PRs in this component so
 * let's skip them.
 * @param {Set} knownIssues
 * @param {Set} actualIssues
 * @param {Set} newIssues
 * @param {Object} issue
 */
function processIssues(knownIssues, actualIssues, newIssues, issue) {
    if (knownIssues && !knownIssues.has(issue['id'])) {
        newIssues.add(issue);
    }
    actualIssues.add(issue['id']);
}

/**
 * Component which triggers whenever new issue is created.
 * @extends {Component}
 */
/**
 * Maximum number of IDs to retain in context.state.known.
 * getNewItems() replaces (not accumulates) known each tick, so this cap only
 * fires if a single tick returns an unusually large page of results.
 */
const MAX_KNOWN = 500;

module.exports = {

    async tick(context) {
        let { repositoryId, includePr = false, state = 'all', labels = [] } = context.properties;

        // Normalize multiselect fields
        const normalizedLabels = labels ? lib.normalizeMultiselectInput(labels, context, 'Labels') : [];

        const query = [
            `repo:${repositoryId}`,
            normalizedLabels.length ? `label:${normalizedLabels.map(label => `"${label}"`).join(',')}` : '',
            state !== 'all' ? `state:${state}` : '',
            !includePr ? 'is:issue' : ''
        ].filter(Boolean).join('+');

        const res = await lib.apiRequest(context, `search/issues?q=${query}`, {
            params: { sort: 'created', order: 'desc' }
        });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.data.items.forEach(processIssues.bind(null, known, actual, diff));

        // When the matching issues do not fit on the page, one of them leaving the results
        // (closed, label removed) pulls an older issue onto it. That issue is unseen but not
        // new: it is no newer than the oldest issue the previous tick read (the floor).
        let { floor } = context.state;
        if (known && floor === undefined) {
            // State saved before the floor existed: nothing older than the newest known issue is new.
            floor = res.data.items.find(issue => known.has(issue.id))?.created_at;
        }
        const newIssues = Array.from(diff).filter(issue => !floor || issue.created_at > floor);

        if (newIssues.length) {
            await Promise.all(newIssues.map(issue => {
                return context.sendJson(issue, 'issue');
            }));
        }

        const knownArr = Array.from(actual);
        const trimmedKnown = knownArr.length > MAX_KNOWN ? knownArr.slice(knownArr.length - MAX_KNOWN) : knownArr;
        const oldest = res.data.items[res.data.items.length - 1];
        await context.saveState({
            known: trimmedKnown,
            floor: oldest && res.data.total_count > res.data.items.length ? oldest.created_at : null
        });
    },

    async test(context) {

        let { repositoryId, includePr = false, state = 'all', labels = [] } = context.properties;

        // Mirror the same query-building branch as tick(), honoring the configured filters.
        const normalizedLabels = labels ? lib.normalizeMultiselectInput(labels, context, 'Labels') : [];

        const query = [
            `repo:${repositoryId}`,
            normalizedLabels.length ? `label:${normalizedLabels.map(label => `"${label}"`).join(',')}` : '',
            state !== 'all' ? `state:${state}` : '',
            !includePr ? 'is:issue' : ''
        ].filter(Boolean).join('+');

        const issue = await lib.fetchLatest(context, `search/issues?q=${query}`, {
            params: { sort: 'created', order: 'desc' }
        });
        if (!issue) {
            throw new Error('No recent issues to use as test data.');
        }
        return context.sendJson(issue, 'issue');
    }
};
