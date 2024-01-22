'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const {quoteId, properties} = context.messages.in.content;
        const propertiesQuery = '&properties=' + properties;

        try {
            const { data } = await hs.call(
                'get', `crm/v3/objects/quotes/${quoteId}`, {}, { query: 'archived=false'.concat(propertiesQuery) });
            return context.sendJson(data, 'quote');

        } catch (err) {
            if (err.status || (err.response && err.response.status) === 404) {
                return context.sendJson({ quoteId }, 'notFound');
            }
            throw err;
        }

    }
};

