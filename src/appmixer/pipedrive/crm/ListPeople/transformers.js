'use strict';

/**
 * @param {Object|string} people
 */
module.exports.peopleToSelectArray = (people) => {

    let transformed = [];

    if (Array.isArray(people)) {
        people.forEach((person) => {

            transformed.push({
                label: person.name,
                value: person.id
            });
        });
    }

    return transformed;
};
