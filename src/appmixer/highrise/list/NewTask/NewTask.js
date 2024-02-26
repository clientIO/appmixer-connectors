'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * process tasks to find newly added
 * @param  {Set} knownTasks
 * @param  {Set} actualTasks
 * @param  {Set} newTasks
 * @param  {Object} task
 */
function processTasks(knownTasks, actualTasks, newTasks, task) {

    if (knownTasks && !knownTasks.has(task['id'])) {
        newTasks.add(task);
    }
    actualTasks.add(task['id']);
}

/**
 * Component which triggers whenever new task is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getNewTasks = Promise.promisify(client.tasks.all, { context: client.tasks });

        let res = await getNewTasks();
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processTasks.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, task => {
                return context.sendJson(task, 'task');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    }
};

