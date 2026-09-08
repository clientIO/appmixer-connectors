'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { checklistId, name, position } = context.messages.in.content;
        if (!checklistId) {
            throw new context.CancelError('Checklist ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (name !== undefined) {
            body.name = name;
        }
        if (position !== undefined) {
            body.position = position;
        }

        await clickUpClient.request('PUT', `/checklist/${checklistId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};
