'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project ID is required.');
        }

        const project = await lib.apiRequest(context, `/projects/${projectId}`);


        console.log(JSON.stringify(project));
        return context.sendJson(project, 'out');
    }
};
