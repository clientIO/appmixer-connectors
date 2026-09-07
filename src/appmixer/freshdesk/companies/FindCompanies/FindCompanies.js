'use strict';

const { apiCall, sendArrayOutput } = require('../../lib');

const DEFAULT_PREFIX = 'freshdesk-companies-export';

// Full schema — returned by the list/search endpoints
const schemaFull = {
    id: { type: 'integer', title: 'Company ID' },
    name: { type: 'string', title: 'Name' },
    description: { type: 'string', title: 'Description' },
    note: { type: 'string', title: 'Note' },
    domains: { type: 'array', title: 'Domains' },
    health_score: { type: 'string', title: 'Health Score' },
    account_tier: { type: 'string', title: 'Account Tier' },
    renewal_date: { type: 'string', title: 'Renewal Date' },
    industry: { type: 'string', title: 'Industry' },
    created_at: { type: 'string', title: 'Created At' },
    updated_at: { type: 'string', title: 'Updated At' }
};

// Partial schema — returned by autocomplete (Search by Name)
const schemaAutocomplete = {
    id: { type: 'integer', title: 'Company ID' },
    name: { type: 'string', title: 'Name' }
};

function getOutputPortOptions(context, outputType) {

    const schema = context.messages.in.content.searchName ? schemaAutocomplete : schemaFull;

    if (outputType === 'object' || outputType === 'first') {
        const options = Object.keys(schema).reduce((res, field) => {
            const { title: label, ...schemaWithoutTitle } = schema[field];
            res.push({ label, value: field, schema: schemaWithoutTitle });
            return res;
        }, [
            { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
        ]);
        return context.sendJson(options, 'out');
    }

    if (outputType === 'array') {
        return context.sendJson([
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } },
            { label: 'Companies', value: 'result', schema: { type: 'array', items: { type: 'object', properties: schema } } }
        ], 'out');
    }

    if (outputType === 'file') {
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content;
        const { outputType = 'array' } = content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        // Search by name via autocomplete
        if (content.searchName) {
            const response = await apiCall(context, {
                url: '/companies/autocomplete',
                params: { name: content.searchName }
            });
            const companies = Array.isArray(response.data) ? response.data : [];
            if (companies.length === 0) return context.sendJson({}, 'notFound');
            return sendArrayOutput({ context, records: companies, outputType, defaultPrefix: DEFAULT_PREFIX });
        }

        // Filter query via search API
        if (content.query) {
            const searchQuery = content.query.startsWith('"') ? content.query : `"${content.query}"`;
            const response = await apiCall(context, {
                url: '/search/companies',
                params: { query: searchQuery }
            });
            const companies = Array.isArray(response.data) ? response.data : (response.data.results || []);
            if (companies.length === 0) return context.sendJson({}, 'notFound');
            return sendArrayOutput({ context, records: companies, outputType, defaultPrefix: DEFAULT_PREFIX });
        }

        // List all companies
        const response = await apiCall(context, { url: '/companies' });
        const companies = response.data || [];
        if (companies.length === 0) return context.sendJson({}, 'notFound');
        return sendArrayOutput({ context, records: companies, outputType, defaultPrefix: DEFAULT_PREFIX });
    }
};
