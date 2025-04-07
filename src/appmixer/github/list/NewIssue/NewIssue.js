'use strict';
const commons = require('../../lib');
const Promise = require('bluebird');

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

    if (knownIssues && !issue['pull_request'] && !knownIssues.has(issue['id'])) {
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

        let { repositoryId } = context.properties;

        const res = await commons.apiRequest(context, `repos/${repositoryId}/issues`);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.data.forEach(processIssues.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, issue => {
                return context.sendJson(issue, 'issue');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    }
};

