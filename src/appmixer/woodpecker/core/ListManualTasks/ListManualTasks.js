'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'integer', title: 'Task ID', example: 7788 },
    type: { type: 'string', title: 'Type', example: 'MANUAL_EMAIL' },
    status: { type: 'string', title: 'Status', example: 'PENDING' },
    campaign_id: { type: 'integer', title: 'Campaign ID', example: 12345 },
    prospect_id: { type: 'integer', title: 'Prospect ID', example: 987654 },
    due_date: { type: 'string', title: 'Due Date', example: '2025-02-01T09:00:00Z' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Tasks', value: 'result' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v2/manual_tasks`,
            headers: lib.getHeaders(context)
        });

        const tasks = Array.isArray(data) ? data : (data.tasks || data.manual_tasks || data.data || []);

        return lib.sendArrayOutput({ context, outputType, records: tasks });
    }
};
