'use strict';

const lib = require('../lib');

// Schema for a single request-log item.
const schema = {
    request_id: { type: 'string', title: 'Request ID' },
    project_uuid: { type: 'string', title: 'Project UUID' },
    created: { type: 'string', title: 'Created' },
    path: { type: 'string', title: 'Path' },
    api_key_id: { type: 'string', title: 'API Key ID' },
    code: { type: 'integer', title: 'Response Code' },
    deployment: { type: 'string', title: 'Deployment' },
    callback: { type: 'string', title: 'Callback' }
};

module.exports = {

    async receive(context) {

        const { projectId, start, end, status, outputType = 'array' } = context.messages.in.content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Requests' });
        }

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const params = lib.cleanParams({
            start,
            end,
            status,
            // Request the maximum page size. Deepgram rejects anything above 100 with
            // "Invalid value for 'limit' parameter". No pagination is performed.
            limit: 100
        });

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/v1/projects/${encodeURIComponent(projectId)}/requests`,
            params
        });

        const records = (data && data.requests) || [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
