"use strict";

const lib = require("../../lib");

module.exports = {
    receive: async function (context) {
        let { 
            name,
            emailOne,
            phone,
            website,
            addressOne,
            addressTwo,
            city,
            state,
            zip,
            countryCode,
            customfields
        } = context.messages.in.content;

        // Use V3 API endpoint for company creation
        let url = "/projects/api/v3/companies.json";

        // Build the company object - JSON.stringify will omit undefined fields automatically
        let companyData = {
            name: name,
            emailOne: emailOne,
            phone: phone,
            website: website,
            addressOne: addressOne,
            addressTwo: addressTwo,
            city: city,
            state: state,
            zip: zip,
            countrycode: countryCode // API expects lowercase 'countrycode'
        };

        // Build the request body following V3 API structure
        let body = {
            company: companyData,
            companyOptions: {},
            tags: []
        };

        // Add custom fields if they're set
        if (customfields?.AND?.length > 0) {
            let sanitizedCustomFields = [];
            for (let cf of customfields.AND) {
                let id = cf.name.split('-')[0];
                let type = cf.name.split('-')[1];

                if (type === 'number') {
                    if (!Number.isInteger(+cf.value)) {
                        throw new Error(`Invalid value "${cf.value}" for number custom field`);
                    }
                    cf.value = parseInt(cf.value, 10);
                }
                sanitizedCustomFields.push({
                    "customFieldId": Number(id),
                    "value": cf.value
                });
            }

            body.company.customFields = sanitizedCustomFields;
        }

        let resp = await lib.callAPI(context, "POST", url, body);

        // V3 API consistently returns: { company: { id, name, phone, ... } }
        if (!resp.company || !resp.company.id) {
            throw new Error("Company creation failed or no ID returned from API");
        }

        // Send the full response to match CreateTask pattern
        context.sendJson(resp, "company");
    },
};
