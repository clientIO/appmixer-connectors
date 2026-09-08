'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { projectId, requestId } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!requestId) {
            throw new context.CancelError('Request ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/v1/projects/${encodeURIComponent(projectId)}/requests/${encodeURIComponent(requestId)}`
        });

        return context.sendJson(data, 'out');
    }
};
