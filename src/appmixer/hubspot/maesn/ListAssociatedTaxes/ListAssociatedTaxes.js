'use strict';
const HubSpot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hubSpot = new HubSpot(auth.accessToken, context.config);
        
        const {quoteId, properties} = context.messages.in.content;
        const propertiesQuery = '&properties=' + properties;
        let resultArray = [];

        var url = `crm/v3/objects/quotes/${quoteId}/associations/taxes`;
        try {
            const {data} = await hubSpot.call('get', url);
            for (const element of data.results) {
                let res = await hubSpot.call('get', `crm/v3/objects/taxes/${element.id}`, {}, { query: 'archived=false'.concat(propertiesQuery) });
                resultArray.push(res.data);
            };
            return context.sendJson(resultArray, 'out');
        } catch (error) {
            // ignore 404 errors, object could be deleted.
            if ((error.status || (error.response && error.response.status)) !== 404) {
                throw error;
            }
        }
    }
};