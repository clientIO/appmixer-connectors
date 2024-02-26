'use strict';

/**
 * Transformer for tags in account
 * @param {Object|string} tags
 */
module.exports.tagsToSelectArray = tags => {

    let transformed = [];

    if (Array.isArray(tags)) {
        tags.forEach(tag => {

            transformed.push({
                label: tag['name'],
                value: tag['guid']
            });
        });
    }

    return transformed;
};
