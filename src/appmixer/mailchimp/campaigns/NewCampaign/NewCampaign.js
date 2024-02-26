'use strict';
const aggregators = require('../../aggregators');

/**
 * Component which triggers whenever new campaign is added to the list.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let since = new Date();

        let campaigns = await aggregators.getCampaigns({
            context,
            qs: {
                'since_create_time': context.state.since || since.toISOString()
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        // process all members given by the service
        campaigns.forEach(
            context.utils.processItem.bind(
                null, known, current, diff, campaign => campaign.id));

        await Promise.all(diff.map(async (campaign) => {
            await context.sendJson(campaign, 'campaign');
        }));

        await context.saveState({
            known: Array.from(current),
            since: since
        });
    }
};
