'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, start, duration, taskId, description, billable, tags } = context.messages.in.content;

        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!start) {
            throw new context.CancelError('Start is required!');
        }
        if (duration === undefined || duration === null) {
            throw new context.CancelError('Duration is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const startMs = Date.parse(start);
        if (Number.isNaN(startMs)) {
            throw new context.CancelError(`Start is not a valid date: ${start}`);
        }

        const body = {
            start: startMs,
            duration: duration * 60 * 1000,
            tid: taskId || undefined,
            description: description || undefined,
            billable: billable !== undefined ? billable : true,
            tags: tags ? tags.split(',').map(s => ({ name: s.trim() })) : undefined
        };

        const response = await clickUpClient.request('POST', `/team/${teamId}/time_entries`, { data: body });

        return context.sendJson(response, 'out');
    }
};
