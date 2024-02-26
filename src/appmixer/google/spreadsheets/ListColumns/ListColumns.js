'use strict';
const commons = require('../../google-commons');
const google = require('googleapis');
const Promise = require('bluebird');

/**
 * Helper function - returns true, if value is null or empty
 * @param  {*} value
 * @return {boolean}
 */
function nullOrEmpty(value) {

    return !value && value !== 0
        || typeof value === 'string' && value.trim() === ''
        || Array.isArray(value) && value.length === 0
        || typeof value === 'object' && Object.keys(value).length === 0;
}

function columnName(column, index) {

    return nullOrEmpty(column) ? 'column' + index : column;
}

/**
 * ListColumns.
 * @extends {Component}
 */
module.exports = {

    receive(context) {
        const sheets = google.sheets('v4');
        const listRows = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });
        return listRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: `${context.properties.worksheetId.split('/')[1]}!1:1`, // Fetch only the first row
            majorDimension: 'ROWS', // Fetch data by rows
        }).then(res => {
            // Extract only the first row from the retrieved data
            const headerRow = res.values ? res.values[0] : [];
            return context.sendJson(headerRow, 'out');
        });
    },

    columnsToSelectArray(columns) {

        let transformed = [];
        if (Array.isArray(columns)) {
            columns.forEach((column, i) => {
                const name = columnName(column, i + 1);
                transformed.push({
                    label: name,
                    value: name
                });
            });
        }

        return transformed;
    },

    columnsToInspector(columns) {

        if (!columns) {
            throw new Error('There is not a header row in the worksheet.');
        }

        // creating inspector template based on: http://jointjs.com/rappid/docs/ui/inspector
        let inspector = {
            inputs: {},
            groups: {
                columns: { label: 'Columns', index: 1 }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column, i) => {
                const index = i + 1;
                inspector.inputs[columnName(column, index)] = {
                    type: 'text',
                    label: columnName(column, index),
                    group: 'columns',
                    index
                };
            });
        }

        return inspector;
    }
};
