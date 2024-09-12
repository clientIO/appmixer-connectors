'use strict';
const commons = require('../../google-commons');
const google = require('googleapis');
const Promise = require('bluebird');

/**
 * Gsheet create row component.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const sheets = google.sheets('v4');
        const getHeader = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });
        const createRow = Promise.promisify(sheets.spreadsheets.values.append, { context: sheets.spreadsheets.values });

        const { sheetId, worksheetId } = context.properties;
        const values = context.messages.in.content;

        // Retrieve header row to get the order of columns
        const headerResponse = await getHeader({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: sheetId,
            range: `${worksheetId.split('/')[1]}!1:1` // Assuming headers are in the first row
        });

        const headerValues = headerResponse.values[0];

        // Map the incoming values to the columns in the sheet
        const orderedValues = headerValues.map(column => values[column] || '');

        const resource = {
            values: [orderedValues]
        };

        // Append the new row directly to the sheet using INSERT_ROWS
        const response = await createRow({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: sheetId,
            range: `${worksheetId.split('/')[1]}!A:A`, // Start appending from column A
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource
        });

        if (response && response.updates) {
            const updates = response.updates;
            return context.sendJson({
                spreadsheetId: updates.spreadsheetId,
                newRange: updates.updatedRange,
                newRows: updates.updatedRows,
                updatedColumns: updates.updatedColumns,
                newCells: updates.updatedCells
            }, 'createdRow');
        }
    }
};
