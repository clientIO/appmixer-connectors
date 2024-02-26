'use strict';
const commons = require('../../asana-commons');

/**
 * Build subtask.
 * @param {Object} subtask
 * @return {Object} subtaskObject
 */
function buildSubtask(subtask) {

    let subtaskObject = {};

    if (subtask['name']) {
        subtaskObject['name'] = subtask['name'];
    }

    if (subtask['note']) {
        subtaskObject['notes'] = subtask['note'];
    }

    if (subtask['dueOnDate']) {
        subtaskObject['due_on'] = subtask['dueOnDate'];
    }

    if (subtask['assignee']) {
        subtaskObject['assignee'] = subtask['assignee'];
    }

    subtaskObject['hearted'] = subtask['hearted'];
    subtaskObject['completed'] = subtask['completed'];

    return subtaskObject;
}

/**
 * Component which creates new subtask when triggered.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let taskContent = context.messages.task.content;
        let taskData = buildSubtask(taskContent);
        let task = taskContent.task;
        delete taskContent.task;

        return client.tasks.addSubtask(task, taskData)
            .then(subtask => {
                return context.sendJson(subtask, 'newSubtask');
            });
    }
};
