'use strict';

/**
 * Transformer for list of labels
 * @param {Object|string} labels
 */
module.exports.labelsToSelectArray = labels => {

    let transformed = [];

    if (Array.isArray(labels)) {
        labels.forEach(label => {

            transformed.push({
                label: label['name'],
                value: label['name']
            });
        });
    }

    return transformed;
};
