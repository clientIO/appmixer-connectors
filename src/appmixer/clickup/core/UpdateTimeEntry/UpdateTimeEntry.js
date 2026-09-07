'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, timeEntryId, description, start, duration, billable, taskId, tags } =
            context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!timeEntryId) {
            throw new context.CancelError('Time Entry ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (description !== undefined) body.description = description;
        if (start !== undefined) body.start = Date.parse(start);
        if (duration !== undefined) body.duration = duration * 60 * 1000;
        if (billable !== undefined) body.billable = billable;
        if (taskId !== undefined) body.tid = taskId;
        if (tags !== undefined) body.tags = tags.split(',').map(s => ({ name: s.trim() }));

        await clickUpClient.request('PUT', `/team/${teamId}/time_entries/${timeEntryId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};
