'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { campaignId } = context.messages.in.content;

        if (!campaignId) {
            throw new context.CancelError('Campaign ID is required!');
        }

        const response = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v2/campaigns/${campaignId}`,
            headers: lib.getHeaders(context)
        });

        return context.sendJson(response.data, 'out');
    }
};
