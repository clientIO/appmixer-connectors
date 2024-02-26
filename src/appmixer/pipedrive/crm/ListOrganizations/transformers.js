'use strict';

/**
 * @param {Object|string} organizations
 */
module.exports.organizationsToSelectArray = (organizations) => {

    var transformed = [];

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
