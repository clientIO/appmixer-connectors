'use strict';

/**
 * @param {Array} fields
 */
module.exports.fieldsToSelectArray = (fields) => {
    const transformed = [];
    if (Array.isArray(fields)) {
        fields.forEach((field) => {
            if (field.edit_flag === true) {
                transformed.push({ label: field.name, value: field.key });
            }
        });
    }
    return transformed;
};
