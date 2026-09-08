'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { goalId, name, description, dueDate, color, addOwners, removeOwners } = context.messages.in.content;
        if (!goalId) {
            throw new context.CancelError('Goal ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (dueDate) body.due_date = Date.parse(dueDate);
        if (color !== undefined) body.color = color;
        if (addOwners) body.add_owners = addOwners.split(',').map(s => s.trim()).map(Number);
        if (removeOwners) body.rem_owners = removeOwners.split(',').map(s => s.trim()).map(Number);

        await clickUpClient.request('PUT', `/goal/${goalId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};
