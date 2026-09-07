'use strict';

const { apiCall, sendArrayOutput } = require('../../lib');

const DEFAULT_PREFIX = 'freshdesk-contacts-export';

// Full contact schema — returned by the filter/search endpoints
const schemaFull = {
    id: { type: 'integer', title: 'Contact ID' },
    name: { type: 'string', title: 'Name' },
    email: { type: 'string', title: 'Email' },
    phone: { type: 'string', title: 'Phone' },
    mobile: { type: 'string', title: 'Mobile' },
    twitter_id: { type: 'string', title: 'Twitter Handle' },
    company_id: { type: 'integer', title: 'Company ID' },
    job_title: { type: 'string', title: 'Job Title' },
    description: { type: 'string', title: 'Description' },
    active: { type: 'boolean', title: 'Active' },
    tags: { type: 'array', title: 'Tags' },
    created_at: { type: 'string', title: 'Created At' },
    updated_at: { type: 'string', title: 'Updated At' }
};

// Partial schema — returned by the autocomplete (Search by Name) endpoint
const schemaAutocomplete = {
    id: { type: 'integer', title: 'Contact ID' },
    name: { type: 'string', title: 'Name' },
    phone: { type: 'string', title: 'Phone' },
    mobile: { type: 'string', title: 'Mobile' },
    avatar: { type: 'string', title: 'Avatar' }
};

function getOutputPortOptions(context, outputType) {

    // Use the appropriate schema based on whether searchName is being used
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
            {
                label: 'Contacts',
                value: 'result',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: schema
                    }
                }
            }
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

        const params = {};

        // Search by name using the autocomplete endpoint
        if (content.searchName) {
            const response = await apiCall(context, {
                url: '/contacts/autocomplete',
                params: { term: content.searchName }
            });
            const contacts = Array.isArray(response.data) ? response.data : [];

            if (contacts.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            return sendArrayOutput({ context, records: contacts, outputType, defaultPrefix: DEFAULT_PREFIX });
        }

        // Filter by a single email or phone (Freshdesk filter params)
        if (content.email) params.email = content.email;
        if (content.phone) params.phone = content.phone;
        if (content.mobilePhone) params.mobile_phone = content.mobilePhone;

        // If search query provided, use the search endpoint
        // Freshdesk search API requires the query wrapped in double quotes, e.g. "email:'test@example.com'"
        if (content.query) {
            const searchQuery = content.query.startsWith('"') ? content.query : `"${content.query}"`;
            const response = await apiCall(context, {
                url: '/search/contacts',
                params: { query: searchQuery }
            });
            const contacts = Array.isArray(response.data) ? response.data : (response.data.results || []);

            if (contacts.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            return sendArrayOutput({ context, records: contacts, outputType, defaultPrefix: DEFAULT_PREFIX });
        }

        // Otherwise use the list/filter endpoint
        if (content.updatedSince) params.updated_since = content.updatedSince;
        if (content.companyId) params.company_id = content.companyId;
        if (content.tag) params.tag = content.tag;

        const response = await apiCall(context, { url: '/contacts', params });

        const contacts = response.data || [];

        if (contacts.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return sendArrayOutput({ context, records: contacts, outputType, defaultPrefix: DEFAULT_PREFIX });
    }
};
