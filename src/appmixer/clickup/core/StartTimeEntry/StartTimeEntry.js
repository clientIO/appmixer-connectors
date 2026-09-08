'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, taskId, description, billable } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!taskId) {
            throw new context.CancelError('Task ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {
            tid: taskId,
            description: description || undefined,
            billable: billable !== undefined ? billable : undefined
        };

        const response = await clickUpClient.request('POST', `/team/${teamId}/time_entries/start`, { data: body });

        return context.sendJson(response, 'out');
    }
};
