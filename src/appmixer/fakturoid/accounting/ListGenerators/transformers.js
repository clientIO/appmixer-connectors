'use strict';

/**
 * @param {Object|string} subjects
 * @param {Object} message.data
 */
module.exports.generatorsToSelectArray = (generators) => {

    var transformed = [];

    if (Array.isArray(generators)) {
        generators.forEach((generator) => {
            transformed.push({
                label: generator.name,
                value: generator.id
            });
        });
    }

    return transformed;
};
