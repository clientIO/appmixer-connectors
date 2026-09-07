'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { spaceId, folderId, name, content, status, priority, dueDate, dueDateTime } =
            context.messages.in.content;
        if (!spaceId && !folderId) {
            throw new context.CancelError('Space ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const listData = { name, content, status, priority };
        if (dueDate) {
            listData.due_date = Date.parse(dueDate);
            listData.due_date_time = dueDateTime;
        }

        const endpoint = folderId ? `/folder/${folderId}/list` : `/space/${spaceId}/list`;
        const list = await clickUpClient.request('POST', endpoint, { data: listData });

        return context.sendJson(list, 'out');
    }
};
