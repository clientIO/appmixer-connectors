'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'integer', 'title': 'Feature Flag ID', 'example': 456 },
    'key': { 'type': 'string', 'title': 'Key', 'example': 'new-onboarding-flow' },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'New onboarding flow' },
    'active': { 'type': 'boolean', 'title': 'Active', 'example': true },
    'created_at': {
        'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z'
    }
};

module.exports = {

    async receive(context) {

        const { projectId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Feature Flags', value: 'result' });
        }

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const { data } = await lib.apiCall(context, {
            url: `/api/projects/${projectId}/feature_flags/`,
            params: { limit: 100 }
        });

        const featureFlags = data.results || [];
        return lib.sendArrayOutput({ context, records: featureFlags, outputType });
    }
};
