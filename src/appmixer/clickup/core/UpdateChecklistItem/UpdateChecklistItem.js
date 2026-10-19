'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { checklistId, checklistItemId, name, resolved, assignee, parent } = context.messages.in.content;
        if (!checklistId) {
            throw new context.CancelError('Checklist ID is required!');
        }
        if (!checklistItemId) {
            throw new context.CancelError('Checklist Item ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (name !== undefined) {
            body.name = name;
        }
        if (resolved !== undefined) {
            body.resolved = resolved;
        }
        if (assignee !== undefined) {
            body.assignee = assignee;
        }
        if (parent !== undefined) {
            body.parent = parent;
        }

        await clickUpClient.request('PUT', `/checklist/${checklistId}/checklist_item/${checklistItemId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};
