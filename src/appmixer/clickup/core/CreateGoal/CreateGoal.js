'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { teamId, name, description, dueDate, color, multipleOwners, owners } = context.messages.in.content;
        if (!teamId) {
            throw new context.CancelError('Team ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {
            name,
            description,
            due_date: dueDate ? Date.parse(dueDate) : undefined,
            color,
            multiple_owners: multipleOwners,
            owners: owners ? owners.split(',').map(s => s.trim()).map(Number) : undefined
        };

        const response = await clickUpClient.request('POST', `/team/${teamId}/goal`, { data: body });

        return context.sendJson(response, 'out');
    }
};
