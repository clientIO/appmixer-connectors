'use strict';
const commons = require('../../google-commons');
const { normalizeHeader, toCellValue, isBadRequestError } = require('../common');
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
        const worksheetName = encodeURIComponent(worksheetId.split('/')[1]);
        const headerResponse = await getHeader({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: sheetId,
            range: `${worksheetName}!1:1` // Assuming headers are in the first row
        });

        const headerValues = headerResponse.values ? headerResponse.values[0] : [];

        if (headerValues.length === 0) {
            throw new context.CancelError('No headers found in the worksheet.');
        }
        // Build a normalized lookup map from the incoming values so that minor
        // whitespace/line-break differences in header names don't break matching.
        const normalizedValues = {};
        Object.keys(values).forEach(key => {
            normalizedValues[normalizeHeader(key)] = values[key];
        });
        // Map the incoming values to the columns in the sheet. A cell accepts only
        // a string, number or boolean: objects and arrays are written as JSON strings.
        const orderedValues = headerValues.map(column => {
            const normalized = normalizeHeader(column);
            const value = normalizedValues[normalized] !== undefined ? normalizedValues[normalized] : values[column];
            return toCellValue(value);
        });

        const resource = {
            values: [orderedValues]
        };

        // Append the new row directly to the sheet using INSERT_ROWS
        let response;
        try {
            response = await createRow({
                auth: commons.getOauth2Client(context.auth),
                spreadsheetId: sheetId,
                range: `${worksheetName}!A:A`, // Start appending from column A
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource
            });
        } catch (err) {
            // A 400 from Google is a request that is invalid by design; a retry
            // fails the same way, so fail once instead of retrying to the limit.
            if (isBadRequestError(err)) {
                throw new context.CancelError(`Google Sheets rejected the row: ${err.message}`);
            }
            throw err;
        }

        if (response?.updates) {
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
