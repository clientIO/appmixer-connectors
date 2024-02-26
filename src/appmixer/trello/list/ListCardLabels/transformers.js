'use strict';

/**
 * Transformer for list of labels
 * @param {Object|string} labels
 */
module.exports.cardLabelsToSelectArray = (labels) => {

    let transformed = [];

    if (Array.isArray(labels)) {
        labels.forEach((label) => {

            transformed.push({
                label: label['color'],
                value: label.id
            });
        });
    }

    return transformed;
};
