'use strict';

/**
 * @param {Array.<Object>} items
 */
module.exports.sitesToSelectArray = items => {

    let transformed = [];
    if (!items) {
        return transformed;
    }

    if (Array.isArray(items)) {
        items.forEach(siteItem => {

            transformed.push({
                label: siteItem.name,
                // eslint-disable-next-line no-underscore-dangle
                value: siteItem._id
            });
        });
    }

    return transformed;
};
