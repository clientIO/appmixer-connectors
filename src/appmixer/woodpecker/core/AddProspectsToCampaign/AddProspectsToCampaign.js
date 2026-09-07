'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { campaignId, prospects, force } = context.messages.in.content;

        if (!campaignId) {
            throw new context.CancelError('Campaign ID is required!');
        }

        if (!prospects) {
            throw new context.CancelError('Prospects are required!');
        }

        let parsedProspects;
        try {
            parsedProspects = typeof prospects === 'object' ? prospects : JSON.parse(prospects);
        } catch (err) {
            throw new context.CancelError('Prospects must be a valid JSON array.');
        }
        if (!Array.isArray(parsedProspects)) {
            throw new context.CancelError('Prospects must be a JSON array of prospect objects.');
        }

        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.API_BASE_URL}/v1/add_prospects_campaign`,
            headers: lib.getHeaders(context),
            data: {
                campaign: { campaign_id: Number(campaignId) },
                prospects: parsedProspects,
                force
            }
        });

        return context.sendJson(response.data, 'out');
    }
};
