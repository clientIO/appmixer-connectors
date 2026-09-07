'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { campaignId } = context.messages.in.content;

        if (!campaignId) {
            throw new context.CancelError('Campaign ID is required!');
        }

        // Campaign statistics are exposed through the v1 campaign detail
        // (GET /v1/campaign_list?id=X → [0].stats); there is no /statistics endpoint on v2.
        const response = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v1/campaign_list`,
            headers: lib.getHeaders(context),
            params: { id: campaignId }
        });

        const campaign = Array.isArray(response.data) ? response.data[0] : null;
        if (!campaign) {
            throw new context.CancelError(`Campaign ${campaignId} not found.`);
        }

        const stats = { ...(campaign.stats || {}) };
        delete stats.emails;
        return context.sendJson({ id: campaign.id, name: campaign.name, status: campaign.status, ...stats }, 'out');
    }
};
