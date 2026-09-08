'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId, personId } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!personId) {
            throw new context.CancelError('Person ID is required!');
        }

        const { data } = await lib.apiCall(context, {
            url: `/api/projects/${projectId}/persons/${personId}/`
        });

        return context.sendJson(data, 'out');
    }
};
