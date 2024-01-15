'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            dealId
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        try {
            const { data } = await hs.call(
                'get',
                `crm/v3/objects/deals/${dealId}`,
                {}
            );
            return context.sendJson(data, 'deal');

        } catch (err) {
            if (err.status || (err.response && err.response.status) === 404) {
                return context.sendJson({  dealId  }, 'notFound');
            }
            throw err;
        }
    }
};
