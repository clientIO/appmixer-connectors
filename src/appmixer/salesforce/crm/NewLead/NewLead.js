'use strict';
const commons = require('../salesforce-commons');
const Promise = require('bluebird');

/**
 * Process leads to find newly added.
 * @param {Set} knownLeads
 * @param {Array} currentLeads
 * @param {Array} newLeads
 * @param {Object} lead
 */
function processLeads(knownLeads, currentLeads, newLeads, lead) {

    if (knownLeads && !knownLeads.has(lead['Id'])) {
        newLeads.push(lead);
    }
    currentLeads.push(lead['Id']);
}

/**
 * Component which triggers whenever new lead is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getSalesforceAPI(context);
        let since = new Date();

        let res = await client.sobject('Lead').find({
            CreatedDate: {
                $gte: commons.Date.toDateTimeLiteral(context.state.since || since)
            }
        });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (res.length) {
            res.forEach(processLeads.bind(null, known, current, diff));
        }

        await Promise.map(diff, lead => {
            return context.sendJson(lead, 'lead');
        });

        await context.saveState({
            known: current,
            since: since
        });
    }
};
