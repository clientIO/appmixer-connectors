'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId, content, dateMarker, scope } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!content) {
            throw new context.CancelError('Content is required!');
        }

        const payload = { content };
        if (dateMarker) {
            payload['date_marker'] = dateMarker;
        }
        if (scope) {
            payload.scope = scope;
        }

        const { data } = await lib.apiCall(context, {
            method: 'POST',
            url: `/api/projects/${projectId}/annotations/`,
            data: payload
        });

        return context.sendJson(data, 'out');
    }
};
