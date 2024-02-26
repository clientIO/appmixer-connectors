'use strict';

/**
 * Transformer for list of branches
 * @param {Object|string} branches
 */
module.exports.branchesToSelectArray = branches => {

    let transformed = [];

    if (Array.isArray(branches)) {
        branches.forEach(branch => {

            transformed.push({
                label: branch['name'],
                value: branch['name']
            });
        });
    }

    return transformed;
};
