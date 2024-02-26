'use strict';
const commons = require('../salesforce-commons');
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
            let dates = [
                'CloseDate',
                'CreatedDate',
                'LastModifiedDate',
                'LastViewedDate',
                'LastReferencedDate',
                'SystemModstamp'
            ];
            opportunity = commons.formatFields(opportunity, dates, commons.formatDate);
            return context.sendJson(opportunity, 'opportunity');
        });

        await context.saveState({
            known: current,
            since: since
        });
    }
};
