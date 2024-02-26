'use strict';

/**
 * @param {Object|string} stages
 */
module.exports.stagesToSelectArray = stages => {

    let transformed = [];

    if (Array.isArray(stages)) {
        stages.forEach((stage) => {

            transformed.push({
                label: stage.name,
                value: stage.id
            });
        });
    }

    return transformed;
};
