'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {
        const sheets = google.sheets('v4');
        const getRows = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });

        const indexColumn = context.properties.index.toUpperCase();
        const worksheet = context.properties.worksheetId.split('/')[1];

        // Construct the range based on the index column
        const range = `${worksheet}!${indexColumn}1:${indexColumn}`;

        // Fetch the data from the specified index column
        const res = await getRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: range,
            majorDimension: 'COLUMNS' // Fetch the data as a column
        });

        const indexValues = res.values && res.values[0] ? res.values[0] : [];

        let known = Array.isArray(context.state.known) ? context.state.known : [];

        // Initialize the state on the first run
        if (known.length === 0) {
            await context.saveState({ known: indexValues });
            return;
        }


        let diff = [];

        // Compare the current index values with the known state
        // Now considering both the length of the arrays and differences in values
        if (indexValues.length !== known.length) {
            // Determine the range of new rows to fetch
            const startRow = known.length + 1; // +1 because known.length gives us the last known row index
            const endRow = indexValues.length;

            for (let i = startRow; i <= endRow; i++) {
                diff.push(i);
            }
        } else {
            // No new rows were added, but we should still check for new or empty rows
            indexValues.forEach((value, rowIndex) => {
                if (!known.includes(value)) {
                    diff.push(rowIndex + 1); // New row detected
                }
            });
        }

        // If new rows are detected, process them
        if (diff.length > 0) {
            const startRow = Math.min(...diff);
            const endRow = Math.max(...diff);
            const rowRange = `${worksheet}!A${startRow}:ZZ${endRow}`;

            const newRowsRes = await getRows({
                auth: commons.getOauth2Client(context.auth),
                spreadsheetId: context.properties.sheetId,
                range: rowRange,
                majorDimension: 'ROWS'
            });

            const headers = (await getRows({
                auth: commons.getOauth2Client(context.auth),
                spreadsheetId: context.properties.sheetId,
                range: `${worksheet}!A1:ZZ1`,
                majorDimension: 'ROWS'
            })).values[0];

            // Send the new rows as output
            await Promise.map(newRowsRes.values, row => {
                return context.sendJson(addHeaders(headers, row), 'out');
            });
        }

        // Save the current index values as the known state for the next tick
        await context.saveState({ known: indexValues });
    }
};

// Helper function to add headers to row cells
function addHeaders(headers, row) {
    let res = {};
    headers.forEach((header, index) => {
        res[header] = row[index] || '';
    });
    return res;
}
