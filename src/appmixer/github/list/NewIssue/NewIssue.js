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

        const res = await lib.apiRequest(context, `search/issues?q=${query}`);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.data.items.forEach(processIssues.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.all(Array.from(diff).map(issue => {
                return context.sendJson(issue, 'issue');
            }));
        }

        await context.saveState({ known: Array.from(actual) });
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
