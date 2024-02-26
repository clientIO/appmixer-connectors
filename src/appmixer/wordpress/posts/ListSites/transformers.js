'use strict';

/**
 * Transformer for sites in account
 * @param {Object|string} sites
 */
module.exports.sitesToSelectArray = sites => {

    let transformed = [];

    if (Array.isArray(sites)) {
        sites.forEach(site => {

            transformed.push({
                label: site['URL'],
                value: site['ID']
            });
        });
    }

    return transformed;
};
