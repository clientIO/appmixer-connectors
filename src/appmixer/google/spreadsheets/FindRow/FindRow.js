'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const _ = require('lodash');
const Promise = require('bluebird');

/**
 * Find rows in rows collection.
 * @param {Array} rows
 * @param {Object} content - input message content
 * @return {Object}
 */
function findRows(rows, content) {

    const filteredRows = [];
    const headers = rows[0];
    const columnIndex = _.indexOf(rows[0], content['column']);

    rows.forEach(row => {

        let push = false;
        const cell = row[columnIndex];

        switch (content.operator) {
            case 'equalTo': {
                push = cell === content.value;
                break;
            }
            case 'notEqualTo': {
                push = cell !== content.value;
                break;
            }
            case 'contains': {
                push = cell && cell.includes(content.value);
                break;
            }
            case 'doesNotContain': {
                push = !cell || !cell.includes(content.value);
                break;
            }
            case 'notEmpty': {
                push = !cell && cell !== '';
                break;
            }
        }

        if (push) {
            filteredRows.push(addHeaders(headers, row));
        }
    });

    return filteredRows;
}

/**
 * Add headers to row cells.
 * @param {Array} headers - first row in sheet.
 * @param {Array} row
 * @return {Object}
 */
function addHeaders(headers, row) {

    let res = {};
    _.each(headers, (header, index) => {
        res[header] = row[index] || '';
    });
    return res;
}

module.exports = {

    receive(context) {

        const sheets = google.sheets('v4');
        const findRow = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });
        return findRow({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: context.properties.worksheetId.split('/')[1],
            majorDimension: 'ROWS'
        }).then(res => {
            const foundRows = findRows(res.values, context.messages.in.content);
            if (foundRows.length === 0) {
                return context.sendJson({}, 'notFound');
            }
            return Promise.map(foundRows, row => {
                return context.sendJson(row, 'out');
            });
        });
    }
};
