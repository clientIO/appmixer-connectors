'use strict';

/**
 * @param {Object|string} filters
 * @param {Object} message.data
 */
module.exports.filtersToSelectArray = (filters) => {

    var transformed = [];

    if (Array.isArray(filters)) {
        filters.forEach((filter) => {

            transformed.push({
                label: filter.name,
                value: filter.id
            });
        });
    }

    return transformed;
};
