'use strict';
const HubSpot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hubSpot = new HubSpot(auth.accessToken, context.config);
        const { dealId } = context.messages.in.content;

        try {
            const { data } = await hubSpot.call('get', `crm/v3/objects/deals/${dealId}/associations/contact`);
            return await context.sendJson(data, 'out');
        } catch (error) {
            // ignore 404 errors, object could be deleted.
            if ((error.status || (error.response && error.response.status)) !== 404) {
                throw error;
            }
        }
    }
};
