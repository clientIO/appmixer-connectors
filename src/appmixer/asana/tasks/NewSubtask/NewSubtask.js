'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process subtasks to find newly added.
 * @param {Set} knownSubtasks
 * @param {Set} actualSubtasks
 * @param {Set} newSubtasks
 * @param {Object} subtask
 */
function processSubtasks(knownSubtasks, actualSubtasks, newSubtasks, subtask) {

    if (knownSubtasks && !knownSubtasks.has(subtask['gid'])) {
        newSubtasks.add(subtask);
    }
    actualSubtasks.add(subtask['gid']);
}

/**
 * Component which triggers whenever new subtask is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let taskId = context.properties.task;

        return client.tasks.subtasks(taskId)
            .then(res => {

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processSubtasks.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(subtask => {
                        promises.push(client.tasks.findById(subtask.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, subtask => {
                    context.sendJson(subtask, 'subtask');
                });
            });
    }
};
