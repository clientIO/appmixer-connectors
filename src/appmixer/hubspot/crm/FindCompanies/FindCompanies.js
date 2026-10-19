'use strict';

const Hubspot = require('../../Hubspot');
const lib = require('../../lib');

// One record of the out port: the flattened company built in receive() — every key is always set.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'domain', 'name', 'numberofemployees', 'industry', 'hs_employee_range'],
    properties: {
        id: { type: 'string', title: 'Company ID', example: '18234567890' },
        domain: { type: 'string', title: 'Domain', example: 'acme.com' },
        name: { type: 'string', title: 'Name', example: 'Acme Inc.' },
        numberofemployees: { type: 'string', title: 'Number of Employees', example: '250' },
        industry: { type: 'string', title: 'Industry', example: 'COMPUTER_SOFTWARE' },
        hs_employee_range: { type: 'string', title: 'Employee Range', example: '100-500' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType, limit = 100, search } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            query: search,
            sorts: [{ propertyName: 'name', direction: 'ASCENDING' }],
            properties: ['domain', 'name', 'numberofemployees', 'industry', 'hs_employee_range'],
            limit
        };

        // https://developers.hubspot.com/docs/api-reference/search/guide#search-default-searchable-properties
        const { data } = await hs.call('post', 'crm/v3/objects/companies/search', payload);
        const { results = [] } = data;

        if (results.length === 0) {
            return context.sendJson({ query: search }, 'notFound');
        }

        // Transform results
        const companies = results.map(company => ({
            id: company.id,
            domain: company.properties.domain || '',
            name: company.properties.name || '',
            numberofemployees: company.properties.numberofemployees || '',
            industry: company.properties.industry || '',
            hs_employee_range: company.properties.hs_employee_range || ''
        }));

        return lib.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: companies
        });
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'object') {

        const properties = await context.componentStaticCall(
            'appmixer.hubspot.crm.GetCompaniesProperties',
            'out',
            {
                transform: './transformers#companyToSelectArray'
            }
        );
        return context.sendJson(properties, 'out');

    } else if (outputType === 'array') {

        const schema = await context.componentStaticCall(
            'appmixer.hubspot.crm.GetCompaniesProperties',
            'out',
            {
                transform: './transformers#companiesToSchema'
            }
        );

        return context.sendJson([{ label: 'Array', value: 'array', schema }], 'out');
    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};
