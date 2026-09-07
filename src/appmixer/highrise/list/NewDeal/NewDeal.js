'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Process deals to find newly added.
 * @param {Set} knownDeals
 * @param {Set} actualDeals
 * @param {Set} newDeals
 * @param {Object} deal
 */
function processDeals(knownDeals, actualDeals, newDeals, deal) {

    if (knownDeals && !knownDeals.has(deal['id'])) {
        newDeals.add(deal);
    }
    actualDeals.add(deal['id']);
}

/**
 * Component which triggers whenever new deal is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getClient(context);
        let res = await commons.fetchCollection(client.deals.get, client.deals);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processDeals.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, deal => {
                return context.sendJson(deal, 'deal');
            });
        }
        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        const client = commons.getClient(context);
        const res = await commons.fetchCollection(client.deals.get, client.deals);
        const deal = commons.pickLatest(res);
        if (!deal) {
            throw new Error('No recent deals to use as test data.');
        }
        return context.sendJson(deal, 'deal');
    }
};

