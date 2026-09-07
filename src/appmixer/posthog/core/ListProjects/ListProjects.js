'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'integer', 'title': 'Project ID', 'example': 12345 },
    'uuid': { 'type': 'string', 'title': 'Project UUID', 'example': '018e3b3c-7c3e-0000-8a2a-56d9b1a2c3d4' },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'My Product' },
    'api_token': { 'type': 'string', 'title': 'Project API Key', 'example': 'phc_AbCdEfGh123456' },
    'created_at': {
        'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z'
    }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Projects', value: 'result' });
        }

        try {
            const url = '/api/projects/?limit=100';
            const { data } = context.properties.isSource
                ? await lib.apiCallCached(context, url)
                : await lib.apiCall(context, { url });
            const projects = data.results || [];
            return lib.sendArrayOutput({ context, records: projects, outputType });
        } catch (err) {
            if (context.properties.isSource) {
                return context.sendJson({ result: [] }, 'out');
            }
            throw err;
        }
    },

    toSelectArray(out) {

        return (out.result || []).map(project => ({
            label: project.name,
            value: project.id
        }));
    }
};
