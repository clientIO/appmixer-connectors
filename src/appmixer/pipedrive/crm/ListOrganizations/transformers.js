'use strict';

/**
 * @param {Object|string} organizations
 */
module.exports.organizationsToSelectArray = (organizations) => {

    let transformed = [];

    if (Array.isArray(organizations)) {
        organizations.forEach((organization) => {

            transformed.push({
                label: organization.name,
                value: organization.id
            });
        });
    }

    return transformed;
};
