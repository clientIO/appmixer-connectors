'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'Document ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'status': { 'type': 'string', 'title': 'Status' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'metadata': { 'type': 'object', 'title': 'Metadata' }
};

module.exports = {

    async receive(context) {

        const { filter, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Documents', value: 'documents' });
        }

        const params = {
            page_size: 100
        };

        if (filter) {
            params.filter = filter;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.ragie.ai/documents',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Accept': 'application/json'
            },
            params
        });

        const documents = data.documents || [];

        if (documents.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: documents, outputType });
    }
};
