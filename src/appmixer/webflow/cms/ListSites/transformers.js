'use strict';

/**
 * @param {Array.<Object>} items
 */
module.exports.sitesToSelectArray = items => {

    var transformed = [];
    if (!items) {
        return transformed;
    }

    if (Array.isArray(items)) {
        items.forEach(siteItem => {

            transformed.push({
                label: siteItem.name,
                value: siteItem._id
            });
        });
    }

    return transformed;
};
