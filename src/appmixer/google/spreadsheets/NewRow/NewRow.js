'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

/**
 * Process rows to find newly added.
 * @param {Set} knownRows
 * @param {Array} currentRows
 * @param {Array} newRows
 * @param {Array} row
 */
function processRows(knownRows, currentRows, newRows, row) {

    if (knownRows && currentRows.length >= knownRows.size) {
        newRows.push(row);
    }
    currentRows.push(row);
}

/**
 * Add headers to row cells.
 * @param {Array} headers - first row in sheet.
 * @param {Array} row
 * @return {Object}
 */
function addHeaders(headers, row) {

    let res = {};
    headers.forEach((header, index) => {
        res[header] = row[index] || '';
    });
    return res;
}

module.exports = {

    async tick(context) {

        const sheets = google.sheets('v4');
        const newRow = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });
        const res = await newRow({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: context.properties.worksheetId.split('/')[1],
            majorDimension: 'ROWS'
        });

        let data = res['values'] || [];
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        data.forEach(processRows.bind(null, known, current, diff));
        await context.saveState({ known: current });

        await Promise.map(diff, row => {
            return context.sendJson(addHeaders(res['values'][0], row), 'out');
        });
    }
};
