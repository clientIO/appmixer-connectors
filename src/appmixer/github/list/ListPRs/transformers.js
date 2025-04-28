'use strict';

/**
 * Transformer for list of PRs
 * @param {Object|string} issues
 */
module.exports.prToSelectArray = issues => {

    let transformed = [];

    if (Array.isArray(issues)) {
        issues.forEach(issue => {

            transformed.push({
                label: issue['title'],
                value: issue['number']
            });
        });
    }

    return transformed;
};
