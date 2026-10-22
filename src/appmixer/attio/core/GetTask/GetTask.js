'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { taskId } = context.messages.in.content;

        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }

        const data = await lib.apiRequest(context, { path: '/v2/tasks/' + encodeURIComponent(taskId) });
        return context.sendJson(lib.mapTask(data.data), 'out');
    }
};
