'use strict';

/**
 * @param {Array.<Object>} items
 */
module.exports.formsToSelectArray = items => {
    const transformed = [];
    if (!items || !Array.isArray(items.forms)) {
        return transformed;
    }

    items.forms.forEach(formItem => {
        transformed.push({
            label: formItem.displayName || formItem.shortName || 'Unnamed Form',
            value: formItem.id
        });
    });

    return transformed;
};
