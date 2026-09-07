'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Process cases to find newly added.
 * @param {Set} knownCases
 * @param {Set} actualCases
 * @param {Set} NewCases
 * @param {Object} aCase
 */
function processCases(knownCases, actualCases, NewCases, aCase) {

    if (knownCases && !knownCases.has(aCase['id'])) {
        NewCases.add(aCase);
    }
    actualCases.add(aCase['id']);
}

/**
 * Component which triggers whenever new case is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getClient(context);
        // Boolean parameter represents that case is open. For closed cases needs to be false
        let res = await commons.fetchCollection(client.cases.get, client.cases, true);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processCases.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, aCase => {
                return context.sendJson(aCase, 'case');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        const client = commons.getClient(context);
        // Mirror tick(): fetch open cases only (the same `true` argument).
        const res = await commons.fetchCollection(client.cases.get, client.cases, true);
        const aCase = commons.pickLatest(res);
        if (!aCase) {
            throw new Error('No recent open cases to use as test data.');
        }
        return context.sendJson(aCase, 'case');
    }
};

