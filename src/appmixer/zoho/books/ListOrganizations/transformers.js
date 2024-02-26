'use strict';

/**
 * Transformer for organizations
 * @param {Object|string} organizations
 */
module.exports.organizationsToSelectArray = organizations => {

    let transformed = [];

    if (Array.isArray(organizations?.items)) {
        organizations.items.forEach(org => {
            transformed.push({ label: org.name, value: org.organization_id });
        });
    }

    return transformed;
};
