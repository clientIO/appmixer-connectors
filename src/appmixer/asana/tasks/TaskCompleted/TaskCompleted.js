'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process completed tasks to find new ones.
 * @param {Set} knownTasks
 * @param {Set} actualTasks
 * @param {Set} newTasks
 * @param {Object} completedTask
 */
function processCompletedTasks(knownTasks, actualTasks, newTasks, completedTask) {

    if (knownTasks && !knownTasks.has(completedTask['gid'])) {
        newTasks.add(completedTask);
    }
    actualTasks.add(completedTask['gid']);
}

/**
 * Component which triggers when task is completed.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let { task, project } = context.properties;

        if (!task) {
            //if task not defined - fetch all tasks and find completed
            return client.tasks.findByProject(project)
                .then(res => {

                    let promises = [];

                    res.data.forEach(task => {
                        promises.push(client.tasks.findById(task.gid));
                    });

                    return Promise.all(promises);
                })
                .then(res => {

                    let completedTasks = [];
                    let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                    let actual = new Set();
                    let diff = new Set();

                    res.forEach(task => {
                        if (task.completed) {
                            completedTasks.push(task);
                        }
                    });

                    completedTasks.forEach(processCompletedTasks.bind(null, known, actual, diff));
                    context.state = { known: Array.from(actual) };

                    if (diff.size) {
                        diff.forEach(task => {
                            context.sendJson(task, 'task');
                        });
                    }
                });
        } else {
            //if task defined fetch this task and process
            return client.tasks.findById(task)
                .then(res => {

                    let completedTasks = [];
                    let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                    let actual = new Set();
                    let diff = new Set();

                    if (res.completed) {
                        completedTasks.push(res);
                    }

                    completedTasks.forEach(processCompletedTasks.bind(null, known, actual, diff));
                    context.state = { known: Array.from(actual) };

                    if (diff.size) {
                        return Promise.map(diff, task => {
                            return context.sendJson(task, 'task');
                        });
                    }
                });
        }
    }
};
