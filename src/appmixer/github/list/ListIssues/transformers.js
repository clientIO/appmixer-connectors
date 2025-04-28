'use strict';

/**
+ * Transforms a list of GitHub issues into an array suitable for selection UI components.
+ * Each issue is converted to an object with label (from title) and value (from number).
+ * 
+ * @param {Object|string} issues - The issues array or string to transform
+ * @returns {Array<{label: string, value: number}>} Array of objects with label and value properties
 */
module.exports.issuesToSelectArray = issues => {

    let transformed = [];

    if (Array.isArray(issues)) {
        issues.forEach(issue => {

            transformed.push({
                label: issue?.title || 'Untitled Issue',
                value: issue?.number
            });
        });
    }

    return transformed;
};
