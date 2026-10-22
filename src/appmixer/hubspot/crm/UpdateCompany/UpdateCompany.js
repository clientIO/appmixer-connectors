'use strict';

const Hubspot = require('../../Hubspot');
const ITEM_SCHEMA = require('../../item-schemas.json').companyUpdate;

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            companyId,
            domain,
            name,
            numberofemployees,
            industry,
            updateStrategy
        } = context.messages.in.content;

        // Need either companyId or domain
        if (!companyId && !domain) {
            throw new context.CancelError('Either Company ID or domain is required!');
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        // Support for additional properties (for flexibility)
        const additionalPropertiesArray = context.messages.in.content.additionalProperties?.AND || [];
        const additionalProperties = additionalPropertiesArray.reduce((acc, field) => {
            acc[field.name] = field.value;
            return acc;
        }, {});

        // If domain provided but no companyId, search for the company first
        let effectiveCompanyId = companyId;
        if (!effectiveCompanyId && domain) {
            const searchPayload = {
                filterGroups: [{
                    filters: [{
                        propertyName: 'domain',
                        operator: 'EQ',
                        value: domain
                    }]
                }],
                limit: 1
            };
            const { data: searchData } = await hs.call('post', 'crm/v3/objects/companies/search', searchPayload);
            if (searchData.results && searchData.results.length > 0) {
                effectiveCompanyId = searchData.results[0].id;
            } else {
                throw new Error(`Company with domain "${domain}" not found!`);
            }
        }

        // Build input properties object
        const inputProperties = {
            domain,
            name,
            numberofemployees,
            industry,
            ...additionalProperties
        };

        // Remove undefined/null properties
        Object.keys(inputProperties).forEach(property => {
            if (inputProperties[property] === undefined || inputProperties[property] === null) {
                delete inputProperties[property];
            }
        });

        let finalProperties = inputProperties;

        // Handle merge strategy (default) - only update empty fields
        if (!updateStrategy || updateStrategy === 'merge') {
            // Fetch existing company to check which fields are empty
            const { data: existingCompany } = await hs.call('get', `crm/v3/objects/companies/${effectiveCompanyId}`);

            // Only include properties that are empty/null in existing company
            finalProperties = {};
            for (const [key, value] of Object.entries(inputProperties)) {
                if (!existingCompany.properties[key] || existingCompany.properties[key] === '') {
                    finalProperties[key] = value;
                }
            }
        }
        // Overwrite strategy: use all provided properties
        // (finalProperties already set to inputProperties)

        if (!Object.keys(finalProperties).length) {
            // No fields to update
            const { data: existingCompany } = await hs.call('get', `crm/v3/objects/companies/${effectiveCompanyId}`);
            return context.sendJson({
                ...existingCompany,
                updated: false,
                message: 'No empty fields to update (merge strategy)'
            }, 'out');
        }

        const payload = {
            properties: finalProperties
        };

        const { data } = await hs.call('patch', `crm/v3/objects/companies/${effectiveCompanyId}`, payload);

        return context.sendJson({
            ...data,
            updated: true
        }, 'out');
    }
};
