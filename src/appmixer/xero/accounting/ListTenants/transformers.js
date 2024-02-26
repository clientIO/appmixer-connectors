'use strict';

/**
 * @param {Object|string} tenants
 */
module.exports.tenantsToSelectArray = tenants => {

    let transformed = [];

    if (Array.isArray(tenants?.items)) {
        tenants.items.forEach(tenant => {

            transformed.push({
                label: tenant['tenantName'],
                value: tenant['tenantId']
            });
        });
    }

    return transformed;
};
