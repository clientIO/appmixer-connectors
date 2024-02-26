'use strict';

/**
 * @param {Object|string} rows
 */
module.exports.rowsToSelectArray = rows => {

    let transformed = [];

    if (Array.isArray(rows)) {
        rows.forEach((row) => {

            transformed.push({
                label: rows.indexOf(row) + 1,
                value: rows.indexOf(row)
            });
        });
    }

    return transformed;
};
