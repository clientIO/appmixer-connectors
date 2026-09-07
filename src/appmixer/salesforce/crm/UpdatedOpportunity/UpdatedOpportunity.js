'use strict';
const commons = require('../lib');

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

module.exports = {

    async start(context) {

        const targetStage = context.properties.stageName;

        const soql = `SELECT Id,StageName FROM Opportunity WHERE StageName != '${targetStage.replace(/'/g, '\\\'')}'`;
        const { data } = await commons.api.salesForceRq(context, {
            method: 'GET',
            action: `query?q=${encodeURIComponent(soql)}`
        });

        let knownStages = {};
        if (data && data.records) {
            data.records.forEach(opportunity => { knownStages[opportunity['Id']] = opportunity['StageName']; });
        }
        await context.saveState({ knownStages });
    },

    async tick(context) {
        let since = new Date();
        const targetStage = context.properties.stageName;

        const lastSince = context.state.since || since;

        const soql = `SELECT FIELDS(ALL) FROM Opportunity WHERE LastModifiedDate >= ${commons.Date.toDateTimeLiteral(lastSince)} LIMIT 200`;
        const { data } = await commons.api.salesForceRq(context, {
            action: `query?q=${encodeURIComponent(soql)}`,
            method: 'GET'
        });

        let res = (data && data.records) ? data.records : [];
        let knownStages = context.state.knownStages || {};

        let newKnownStages = { ...knownStages };

        let triggered = [];
        if (res.length && targetStage) {
            res.forEach(opportunity => {
                const id = opportunity['Id'];
                const prevStage = knownStages[id];
                const currStage = opportunity['StageName'];

                // Only trigger if stage changed to targetStage
                if (currStage === targetStage && prevStage !== targetStage) {
                    triggered.push(opportunity);
                }
                // Update known stage
                newKnownStages[id] = currStage;
            });
        }
        await Promise.all(triggered.map(opportunity => {
            return context.sendJson(mapOpportunity(opportunity), 'opportunity');
        }));
        await context.saveState({ knownStages: newKnownStages, since });
    },

    async test(context) {

        const targetStage = context.properties.stageName;
        if (!targetStage) {
            throw new context.CancelError('Stage Name is required!');
        }

        // Mirror tick()'s emitted shape: the newest opportunity currently at the target
        // stage. No `since`/known-stage baseline (which would suppress fresh output) and
        // no state writes — just fetch newest-first matching the configured filter.
        const soql = `SELECT FIELDS(ALL) FROM Opportunity WHERE StageName = '${targetStage.replace(/'/g, '\\\'')}' ORDER BY LastModifiedDate DESC LIMIT 1`;
        const { data } = await commons.api.salesForceRq(context, {
            method: 'GET',
            action: `query?q=${encodeURIComponent(soql)}`
        });

        const opportunity = (data && data.records && data.records[0]) || null;
        if (!opportunity) {
            throw new Error(`No recent opportunities at stage "${targetStage}" to use as test data.`);
        }
        return context.sendJson(mapOpportunity(opportunity), 'opportunity');
    }
};
