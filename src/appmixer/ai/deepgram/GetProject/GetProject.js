'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { projectId } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/v1/projects/${encodeURIComponent(projectId)}`
        });

        return context.sendJson(data, 'out');
    }
};
