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

        await lib.apiCall(context, {
            method: 'DELETE',
            url: `/api/projects/${projectId}/persons/${personId}/`
        });

        return context.sendJson({}, 'out');
    }
};
