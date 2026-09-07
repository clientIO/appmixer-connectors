'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { goalId, name, type, stepsStart, stepsEnd, unit, owners, taskIds, listIds } =
            context.messages.in.content;
        if (!goalId) {
            throw new context.CancelError('Goal ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }
        if (!type) {
            throw new context.CancelError('Type is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {
            name,
            type,
            steps_start: stepsStart,
            steps_end: stepsEnd,
            unit,
            owners: owners ? owners.split(',').map(s => s.trim()).map(Number) : undefined,
            task_ids: taskIds ? taskIds.split(',').map(s => s.trim()) : undefined,
            list_ids: listIds ? listIds.split(',').map(s => s.trim()) : undefined
        };

        const response = await clickUpClient.request('POST', `/goal/${goalId}/key_result`, { data: body });

        return context.sendJson(response, 'out');
    }
};
