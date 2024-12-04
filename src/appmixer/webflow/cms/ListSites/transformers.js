'use strict';

/**
 * @param {Array.<Object>} items
 */
module.exports.sitesToSelectArray = items => {
    const transformed = [];
    if (!items || !Array.isArray(items.sites)) {
        return transformed;
    }

    items.sites.forEach(siteItem => {
        transformed.push({
            label: siteItem.displayName || siteItem.shortName || 'Unnamed Site',
            value: siteItem.id
        });
    });

    return transformed;
};
