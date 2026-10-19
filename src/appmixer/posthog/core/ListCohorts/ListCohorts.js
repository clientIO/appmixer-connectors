'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'integer', 'title': 'Cohort ID', 'example': 321 },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'Power users' },
    'description': { 'type': 'string', 'title': 'Description', 'example': 'Users active more than 5 days a week' },
    'count': { 'type': 'integer', 'title': 'Person Count', 'example': 1500 },
    'is_static': { 'type': 'boolean', 'title': 'Is Static', 'example': false },
    'created_at': {
        'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2025-01-15T10:30:00Z'
    }
};

module.exports = {

    async receive(context) {

        const { projectId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Cohorts', value: 'result' });
        }

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const { data } = await lib.apiCall(context, {
            url: `/api/projects/${projectId}/cohorts/`,
            params: { limit: 100 }
        });

        const cohorts = data.results || [];
        return lib.sendArrayOutput({ context, records: cohorts, outputType });
    }
};
