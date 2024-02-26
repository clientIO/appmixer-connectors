'use strict';

/**
 * Transformer for list of repositories
 * @param {Object|string} repositories
 */
module.exports.reposToSelectArray = repositories => {

    let transformed = [];

    if (Array.isArray(repositories)) {
        repositories.forEach(repository => {

            transformed.push({
                label: repository['full_name'],
                value: repository['full_name']
            });
        });
    }

    return transformed;
};
