'use strict';

/**
 * Transformer for list of issues
 * @param {Object|string} issues
 */
module.exports.issuesToSelectArray = issues => {

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
