'use strict';

/**
 * Transformer for tasks in project
 * @param {Object|string} tasks
 */
module.exports.tasksToSelectArray = tasks => {

    let transformed = [];

    if (Array.isArray(tasks)) {
        tasks.forEach(task => {

            transformed.push({
                label: task['name'],
                value: task['gid']
            });
        });
    }

    return transformed;
};
