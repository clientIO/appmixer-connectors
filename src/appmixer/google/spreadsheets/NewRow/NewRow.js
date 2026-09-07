'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const { normalizeHeader } = require('../common');
const Promise = require('bluebird');

// Shared fetch helper used by both tick() and test() so requests go through the same path.
function makeGetRows() {
    const sheets = google.sheets('v4');
    return Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });
}

// Shared row-building helper used by both tick() and test() so the emitted shape is identical.
// Fetches the row at `rowNumber` (1-based) together with the header row and returns the same
// object tick() emits: { rowId, ...addHeaders(headers, row) }.
async function fetchRowAsOutput(context, getRows, worksheetName, rowNumber) {

    const rowRes = await getRows({
        auth: commons.getOauth2Client(context.auth),
        spreadsheetId: context.properties.sheetId,
        range: `${worksheetName}!A${rowNumber}:ZZ${rowNumber}`,
        majorDimension: 'ROWS'
    });

    const row = (rowRes.values && rowRes.values[0]) ? rowRes.values[0] : [];

    const headers = (await getRows({
        auth: commons.getOauth2Client(context.auth),
        spreadsheetId: context.properties.sheetId,
        range: `${worksheetName}!A1:ZZ1`,
        majorDimension: 'ROWS'
    })).values[0];

    return { rowId: rowNumber, ...addHeaders(headers, row) };
}

module.exports = {

    async tick(context) {
        const getRows = makeGetRows();

        const indexColumn = context.properties.index.toUpperCase();
        const worksheetName = encodeURIComponent(context.properties.worksheetId.split('/')[1]);

        // Construct the range based on the index column
        const range = `${worksheetName}!${indexColumn}1:${indexColumn}`;

        // Fetch the data from the specified index column
        const res = await getRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range,
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
        if (indexValues.length !== known.length) {
            // Determine the range of new rows to fetch
            const startRow = known.length + 1; // +1 because known.length gives us the last known row index
            const endRow = indexValues.length;

            for (let i = startRow; i <= endRow; i++) {
                diff.push(i);
            }
        } else {
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
            const rowRange = `${worksheetName}!A${startRow}:ZZ${endRow}`;

            const newRowsRes = await getRows({
                auth: commons.getOauth2Client(context.auth),
                spreadsheetId: context.properties.sheetId,
                range: rowRange,
                majorDimension: 'ROWS'
            });

            const headers = (await getRows({
                auth: commons.getOauth2Client(context.auth),
                spreadsheetId: context.properties.sheetId,
                range: `${worksheetName}!A1:ZZ1`,
                majorDimension: 'ROWS'
            })).values[0];

            // Send the new rows as output with rowId
            await Promise.map(newRowsRes.values, (row, index) => {
                const rowId = startRow + index;
                return context.sendJson({ rowId, ...addHeaders(headers, row) }, 'out');
            });
        }

        // Save the current index values as the known state for the next tick
        await context.saveState({ known: indexValues });
    },

    // Flow Test Mode: emit the newest row (the last populated cell in the index column)
    // using the SAME fetch + addHeaders mapping path tick() uses. No baseline/state — tick()
    // suppresses its first run while seeding state.known, so test() fetches the latest row
    // directly. Read-only, no state writes.
    async test(context) {

        const getRows = makeGetRows();

        const indexColumn = context.properties.index.toUpperCase();
        const worksheetName = encodeURIComponent(context.properties.worksheetId.split('/')[1]);

        const res = await getRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: context.properties.sheetId,
            range: `${worksheetName}!${indexColumn}1:${indexColumn}`,
            majorDimension: 'COLUMNS'
        });

        const indexValues = res.values && res.values[0] ? res.values[0] : [];

        // The header row counts as row 1, so the newest data row needs at least 2 entries.
        if (indexValues.length < 2) {
            throw new Error('No rows available in the worksheet to use as test data.');
        }

        const rowNumber = indexValues.length;
        const output = await fetchRowAsOutput(context, getRows, worksheetName, rowNumber);

        return context.sendJson(output, 'out');
    }
};

// Helper function to add headers to row cells.
// Headers are normalized (whitespace/line-breaks collapsed) so that minor
// edits to Google Form questions don't produce unrecognized keys.
function addHeaders(headers, row) {
    let res = {};
    headers.forEach((header, index) => {
        res[normalizeHeader(header)] = row[index] || '';
    });
    return res;
}
