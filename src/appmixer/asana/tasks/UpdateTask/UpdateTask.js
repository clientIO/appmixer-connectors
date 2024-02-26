'use strict';
const commons = require('../../asana-commons');

/**
 * Build task.
 * @param {Object} task
 * @param {String} assignee
 * @return {Object} taskObject
 */
function buildTask(task, assignee) {

    let taskObject = {};

    if (task['name']) {
        taskObject['name'] = task['name'];
    }

    if (task['note']) {
        taskObject['notes'] = task['note'];
    }

    if (task['dueOnDate']) {
        taskObject['due_on'] = task['dueOnDate'];
    }

    if (assignee) {
        taskObject['assignee'] = assignee;
    }

    //undefined wont change value in asana
    taskObject['hearted'] = task['hearted'];
    taskObject['completed'] = task['completed'];

    return taskObject;
}

/**
 * Component which updates a task when triggered.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let taskContent = context.messages.task.content;
        const { assignee, task } = taskContent;
        let taskData = buildTask(taskContent, assignee);

        return client.tasks.update(task, taskData)
            .then(task => {
                return context.sendJson(task, 'updatedTask');
            });
    }
};
