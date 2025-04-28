'use strict';

/**
+ * Transformer to convert a list of pull requests into a format suitable for selection components
+ * @param {Object[]|string|Object} issues - Array of pull request objects with title and number properties
+ * @returns {Array<{label: string, value: number}>} Array of objects with label and value properties
 */
module.exports.prToSelectArray = issues => {

    let transformed = [];

    if (Array.isArray(issues)) {
        issues.forEach(issue => {

            transformed.push({
                label: issue['title'] !== undefined ? issue['title'] : 'undefined',
                value: issue['number'] !== undefined ? issue['number'] : 'undefined'
            });
        });
    }

    return transformed;
};
