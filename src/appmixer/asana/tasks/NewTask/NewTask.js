'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process tasks to find newly added.
 * @param {Set} knownTasks
 * @param {Set} actualTasks
 * @param {Set} newTasks
 * @param {Object} task
 */
function processTasks(knownTasks, actualTasks, newTasks, task) {

    if (knownTasks && !knownTasks.has(task['gid'])) {
        newTasks.add(task);
    }
    actualTasks.add(task['gid']);
}

/**
 * Component which triggers whenever new task is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let projectId = context.properties.project;

        return client.tasks.findAll({ project: projectId })
            .then(res => {

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processTasks.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(task => {
                        promises.push(client.tasks.findById(task.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, task => {
                    return context.sendJson(task, 'task');
                });
            });
    },

    async test(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        const projectId = context.properties.project;

        // Same listing + findById path as tick(), just picking the newest task.
        const res = await client.tasks.findAll({ project: projectId });
        const latest = commons.pickLatest(res.data);
        if (!latest) {
            throw new Error('No recent tasks to use as test data.');
        }
        const task = await client.tasks.findById(latest.gid);
        return context.sendJson(task, 'task');
    }
};
