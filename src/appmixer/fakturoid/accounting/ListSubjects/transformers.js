'use strict';

/**
 * @param {Object|string} subjects
 * @param {Object} message.data
 */
module.exports.subjectsToSelectArray = (subjects) => {

    var transformed = [];

    if (Array.isArray(subjects)) {
        subjects.forEach((subject) => {
            transformed.push({
                label: subject.name,
                value: subject.id
            });
        });
    }

    return transformed;
};
