'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            dealId,
            dealname,
            dealstage,
            pipeline,
            hubSpotOwnerId,
            closedate,
            amount
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const additionalPropertiesArray = context.messages.in.content.additionalProperties?.AND || [];
        const additionalProperties = additionalPropertiesArray.reduce((acc, field) => {
            acc[field.name] = field.value;
            return acc;
        }, {});

        const payload = {
            properties: {
                amount: amount,
                dealname: dealname,
                dealstage: dealstage,
                hubspot_owner_id: hubSpotOwnerId,
                pipeline:  pipeline,
                ...additionalProperties
            }
        };

        if (closedate) {
            payload.properties.closedate = (new Date(closedate)).toISOString();
        }


        Object.keys(payload.properties).forEach(property => {
            if (!payload.properties[property]) {
                delete payload.properties[property];
            }
        });

        if (!Object.keys(payload.properties).length) {
            return context.sendJson({ dealId }, 'notUpdated');
        }

        const { data } = await hs.call('patch', `crm/v3/objects/deals/${dealId}`, payload);

        return context.sendJson(data, 'updateDeal');
    }
};
