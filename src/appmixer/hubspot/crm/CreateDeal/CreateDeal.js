'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            dealname,
            dealstage,
            pipeline,
            hubSpotOwnerId,
            closedate,
            amount
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const customFieldsArray = context.messages.in.content.customProperties?.AND || [];
        const customProperties = customFieldsArray.reduce((acc, field) => {
            acc[field.name] = field.value;
            return acc;
        }, {});

        const payload = {
            properties: {
                amount: amount || '',
                dealname: dealname,
                dealstage: dealstage || 'appointmentscheduled',
                hubspot_owner_id: hubSpotOwnerId,
                pipeline:  pipeline || 'default',
                ...customProperties
            }
        };


        if (closedate) {
            payload.properties.closedate = (new Date(closedate)).toISOString();
        }

        const { data } = await hs.call('post', 'crm/v3/objects/deals', payload);

        return context.sendJson(data, 'newDeal');
    }
};
