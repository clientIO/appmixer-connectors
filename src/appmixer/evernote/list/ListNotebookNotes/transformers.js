'use strict';

/**
 * Transformer for notes in notebook
 * @param {Object|string} notes
 */
module.exports.notesToSelectArray = notes => {

    let transformed = [];

    if (Array.isArray(notes)) {
        notes.reverse();
        notes.forEach(note => {

            transformed.push({
                label: note['title'],
                value: note['guid']
            });
        });
    }

    return transformed;
};
