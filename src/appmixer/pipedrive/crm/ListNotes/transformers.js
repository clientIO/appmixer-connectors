'use strict';

/**
 * @param {Object|string} notes
 */
module.exports.notesToSelectArray = notes => {

    let transformed = [];

    if (Array.isArray(notes)) {
        notes.forEach(note => {

            transformed.push({
                label: note.content,
                value: note.id
            });
        });
    }

    return transformed;
};
