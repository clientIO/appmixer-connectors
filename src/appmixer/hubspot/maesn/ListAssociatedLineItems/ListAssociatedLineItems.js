'use strict';
const HubSpot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hubSpot = new HubSpot(auth.accessToken, context.config);

        const { quoteId, dealId, properties } = context.messages.in.content;
        const propertiesQuery = '&properties=' + properties;

        let resultArray = [];
        let url;
        if (quoteId) {
            url = `crm/v3/objects/quotes/${quoteId}/associations/line_items`;
        } else {
            url = `crm/v3/objects/deals/${dealId}/associations/line_items`;
        }
        try {
            const { data } = await hubSpot.call('get', url);
            for (const element of data.results) {
                let res = await hubSpot.call('get', `crm/v3/objects/line_items/${element.id}`, {}, { query: 'archived=false'.concat(propertiesQuery) });
                resultArray.push(res.data);
            }
            //);
            return context.sendJson(resultArray, 'out');
        } catch (error) {
            // ignore 404 errors, object could be deleted.
            if ((error.status || (error.response && error.response.status)) !== 404) {
                throw error;
            }
        }
    }
};
