'use strict';
const Hubspot = require('../../Hubspot');
const ITEM_SCHEMA = require('../../item-schemas.json').company;

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            domain,
            name,
            numberofemployees,
            industry
        } = context.messages.in.content;

        if (!domain) {
            throw new context.CancelError('Company domain is required!');
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        // Support for additional properties (for flexibility)
        const additionalPropertiesArray = context.messages.in.content.additionalProperties?.AND || [];
        const additionalProperties = additionalPropertiesArray.reduce((acc, field) => {
            acc[field.name] = field.value;
            return acc;
        }, {});

        const payload = {
            properties: {
                domain,
                name: name || '',
                numberofemployees: numberofemployees || '',
                industry: industry || '',
                ...additionalProperties
            }
        };

        const { data } = await hs.call('post', 'crm/v3/objects/companies', payload);

        return context.sendJson(data, 'out');
    }
};
