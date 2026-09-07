'use strict';
const commons = require('../lib');
const Promise = require('bluebird');

/**
 * Process opportunities to find newly added.
 * @param {Set} knownOpportunities
 * @param {Array} currentOpportunities
 * @param {Array} newOpportunities
 * @param {Object} opportunity
 */
function processOpportunities(knownOpportunities, currentOpportunities, newOpportunities, opportunity) {

    if (knownOpportunities && !knownOpportunities.has(opportunity['Id'])) {
        newOpportunities.push(opportunity);
    }
    currentOpportunities.push(opportunity['Id']);
}

const DATE_FIELDS = [
    'CloseDate',
    'CreatedDate',
    'LastModifiedDate',
    'LastViewedDate',
    'LastReferencedDate',
    'SystemModstamp'
];

/**
 * Reformat a raw opportunity record's date fields to ISO. Shared by tick() and test()
 * so both emit an identically shaped opportunity.
 * @param {Object} opportunity
 * @return {Object} opportunity
 */
function mapOpportunity(opportunity) {
    return commons.formatFields(opportunity, DATE_FIELDS, commons.formatDate);
}

/**
 * Component which triggers whenever new opportunity is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getSalesforceAPI(context);
        let since = new Date();

        let res = await client.sobject('Opportunity').find({
            CreatedDate: {
                $gte: commons.Date.toDateTimeLiteral(context.state.since || since)
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (res.length) {
            res.forEach(processOpportunities.bind(null, known, current, diff));
        }

        await Promise.map(diff, opportunity => {
            return context.sendJson(mapOpportunity(opportunity), 'opportunity');
        });

        await context.saveState({
            known: current,
            since: since
        });
    },

    async test(context) {

        const opportunity = await commons.findLatestSObject(context, 'Opportunity');
        if (!opportunity) {
            throw new Error('No recent opportunities to use as test data.');
        }
        return context.sendJson(mapOpportunity(opportunity), 'opportunity');
    }
};
