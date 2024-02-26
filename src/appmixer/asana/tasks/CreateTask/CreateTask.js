'use strict';
const commons = require('../../asana-commons');

/**
 * Build task.
 * @param {Object} task
 * @return {Object} taskObject
 */
function buildTask(task) {

    let taskObject = {};

    if (task['name']) {
        taskObject['name'] = task['name'];
    }

    if (task['project']) {
        taskObject['projects'] = task['project'];
    }

    if (task['assignee']) {
        taskObject['assignee'] = task['assignee'];
    }

    if (task['note']) {
        taskObject['notes'] = task['note'];
    }

    if (task['dueOnDate']) {
        taskObject['due_on'] = task['dueOnDate'];
    }

    taskObject['hearted'] = task['hearted'];
    taskObject['completed'] = task['completed'];

    return taskObject;
}

/**
 * Component which creates new task when triggered.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let task = context.messages.task.content;
        let { workspace } = task;
        let taskData = buildTask(task);

        return client.tasks.createInWorkspace(workspace, taskData)
            .then(task => {
                return context.sendJson(task, 'newTask');
            });
    }
};
