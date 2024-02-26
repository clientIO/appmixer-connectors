'use strict';
const ClickUpClient = require('../../ClickUpClient');

const parseStringToArray = (s) => s?.split(',').map(item => item.trim()) ?? [];

module.exports = {

    async receive(context) {

        const {
            taskId,
            name,
            description,
            assigneesToAdd,
            assigneesToRemove,
            status,
            priority,
            dueDate,
            dueDateTime,
            startDate,
            startDateTime,
            notifyAll,
            parent,
            archived
        } = context.messages.in.content;

        const clickUpClient = new ClickUpClient(context);

        const taskData = {
            name,
            description,
            assignees: { add: parseStringToArray(assigneesToAdd), rem: parseStringToArray(assigneesToRemove) },
            status,
            priority,
            due_date: dueDate && Date.parse(dueDate),
            due_date_time: dueDateTime,
            start_date: startDate && Date.parse(startDate),
            start_date_time: startDateTime,
            notify_all: notifyAll,
            parent,
            archived
        };

        const createdTask = await clickUpClient.request('PUT', `/task/${taskId}`, { data: taskData });

        return context.sendJson(createdTask, 'out');
    }
};
