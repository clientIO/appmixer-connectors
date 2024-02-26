'use strict';

/**
 * @param {Array} files
 */
module.exports.filesToSelectArray = (files) => {

    let transformed = [];
    if (!files) {
        return transformed;
    }
    files = Array.isArray(files) ? files : [files];
    files.forEach((file) => {
        transformed.push({
            label: file['path_display'],
            value: file.id
        });
    });

    return transformed;
};
