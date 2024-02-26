'use strict';

/**
 * @param {Object|string} files
 */
module.exports.filesToSelectArray = files => {

    let transformed = [];

    if (Array.isArray(files)) {
        files.forEach(file => {

            transformed.push({
                label: file['name'],
                value: file.id
            });
        });
    }

    return transformed;
};
