'use strict';

/**
 * Maps the ListTrackingCategories output to a Designer select array.
 * Lives here (next to the source component) because dropdown `source.data.transform`
 * is resolved relative to the component named in `source.url` — i.e. ListTrackingCategories.
 * @param {Object|string} trackingCategories
 */
module.exports.categoriesToSelectArray = trackingCategories => {

    let transformed = [];

    if (Array.isArray(trackingCategories?.items)) {
        trackingCategories.items.forEach(category => {

            transformed.push({
                label: category['Name'],
                value: category['TrackingCategoryID']
            });
        });
    }

    return transformed;
};
