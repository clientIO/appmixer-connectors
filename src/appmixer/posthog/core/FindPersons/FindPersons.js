'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'Person ID', 'example': '740618a0-913f-5eb1-b8b1-b43de8b81e8d' },
    'uuid': { 'type': 'string', 'title': 'Person UUID', 'example': '018e3b3c-7c3e-0000-8a2a-56d9b1a2c3d4' },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'Jane Doe' },
    'distinct_ids': {
        'type': 'array', 'title': 'Distinct IDs', 'items': { 'type': 'string' }, 'example': ['user-42']
    },
    'properties': {
        'type': 'object', 'title': 'Properties', 'example': { 'email': 'jane@example.com' }
    },
    'created_at': {
        'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z'
    }
};

module.exports = {

    async receive(context) {

        const { projectId, search, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Persons', value: 'result' });
        }

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const params = { limit: 100 };
        if (search) {
            params.search = search;
        }

        const { data } = await lib.apiCall(context, {
            url: `/api/projects/${projectId}/persons/`,
            params
        });

        const persons = data.results || [];

        if (persons.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: persons, outputType });
    }
};
