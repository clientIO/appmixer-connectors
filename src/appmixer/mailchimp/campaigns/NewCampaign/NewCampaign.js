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
    },

    async test(context) {

        // Newest campaign via the same request stack as tick(), without the
        // since_create_time baseline filter (which suppresses output on a fresh flow).
        const campaign = await aggregators.getMailchimpDriver()
            .getLatest(context, '/campaigns', 'campaigns', 'create_time');
        if (!campaign) {
            throw new Error('No recent campaigns to use as test data.');
        }
        return context.sendJson(campaign, 'campaign');
    }
};
