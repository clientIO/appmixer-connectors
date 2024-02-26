'use strict';

/**
 * Transformer for persons in person
 * @param {Object|string} persons
 */
module.exports.personsToSelectArray = persons => {

    let transformed = [];

    if (Array.isArray(persons)) {
        persons.forEach(person => {

            transformed.push({
                label: `${person['firstName']} ${person['lastName']}`,
                value: person['id']
            });
        });
    }

    return transformed;
};
