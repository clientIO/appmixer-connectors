'use strict';

/**
 * Transformer for list of assignees
 * @param {Object|string} assignees
 */
module.exports.assigneesToSelectArray = assignees => {

    let transformed = [];

    if (Array.isArray(assignees)) {
        assignees.forEach(assignee => {

            transformed.push({
                label: assignee['login'],
                value: assignee['login']
            });
        });
    }

    return transformed;
};
