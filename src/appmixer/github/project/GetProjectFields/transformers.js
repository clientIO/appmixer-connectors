'use strict';

/**
 * Transformer for the list of project fields. GetProjectFields answers with
 * `{ result: [...], count }` for the array output type; a bare array is tolerated
 * so the transformer keeps working if the output type changes.
 * @param {Object|Array} fields
 */
module.exports.fieldsToSelectArray = fields => {

    const records = Array.isArray(fields)
        ? fields
        : (fields && Array.isArray(fields.result) ? fields.result : []);

    let transformed = [];

    records.forEach(field => {

        transformed.push({
            label: field['name'],
            value: field['id']
        });
    });

    return transformed;
};
