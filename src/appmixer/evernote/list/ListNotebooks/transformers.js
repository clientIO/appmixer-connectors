'use strict';

/**
 * Transformer for notebooks in account
 * @param {Object|string} notebooks
 */
module.exports.notebooksToSelectArray = notebooks => {

    let transformed = [];

    if (Array.isArray(notebooks)) {
        notebooks.forEach(notebook => {

            transformed.push({
                label: notebook['name'],
                value: notebook['guid']
            });
        });
    }

    return transformed;
};
