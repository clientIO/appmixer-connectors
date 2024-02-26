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

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getNewCase = Promise.promisify(client.cases.get, { context: client.cases });

        // Boolean parameter represents that case is open. For closed cases needs to be false
        let res = await getNewCase(true);
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
    }
};

