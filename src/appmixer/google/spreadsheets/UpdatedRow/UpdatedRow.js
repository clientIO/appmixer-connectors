'use strict';
const google = require('googleapis');
const Promise = require('bluebird');
const commons = require('../../google-commons');
const { normalizeHeader } = require('../common');

/**
 * Compares two arrays to find if values at same index are different
 * @param {Array} newRows
 * @param {Array} oldRows
 * @param {boolean} includeHeaders
 * @param {string} format
 * @return {boolean}
 */
const getChangedRows = (newRows, oldRows, includeHeaders, format) => {

    // must be declared inside function to run in worker
    const areColumnsEqual = (newColumns, oldColumns) => {
        if (!Array.isArray(oldColumns)) {
            return false;
        }
        if (newColumns.length !== oldColumns.length) {
            return true;
        }
        const newColumnsLength = newColumns.length;
        for (let columnIndex = 0; columnIndex < newColumnsLength; columnIndex++) {
            const newData = newColumns[columnIndex];
            const oldData = oldColumns[columnIndex];
            if (Array.isArray(newData) && Array.isArray(oldData)) {
                if (!areColumnsEqual(newData, oldData)) {
                    return false;
                }
            } else if (newData !== oldData) {
                return false;
            }
        }
        return true;
    };

    /**
     * Makes an object using header elements as key of object
     * @param {Array} headerRow
     * @param {Array} dataRow
     * @return {Object}
     */
    const rowWithHeader = (headerRow, dataRow) => {

        return headerRow.reduce((rowWithHeader, headerCell, cellIndex) => {
            rowWithHeader[normalizeHeader(headerCell)] = dataRow[cellIndex] || '';
            return rowWithHeader;
        }, {});
    };

    const changed = [];
    const headers = newRows[0];
    newRows.forEach((currentRow, currentRowIndex) => {
        const previousRow = oldRows[currentRowIndex] || null;
        if (!areColumnsEqual(currentRow, previousRow)) {
            const outputRow =
        includeHeaders && format === 'object'
            ? rowWithHeader(headers, currentRow)
            : currentRow;
            changed.push({ row: outputRow, index: currentRowIndex });
        }
    });
    return changed;
};

// Shared fetch helper used by both tick() and test() so requests go through the same path.
async function fetchSheetRows(context) {

    const { sheetId, worksheetId } = context.properties;
    const [, worksheetName] = worksheetId.split('/');
    const sheets = google.sheets('v4');
    const getSheetRows = Promise.promisify(sheets.spreadsheets.values.get, {
        context: sheets.spreadsheets.values
    });

    const response = await getSheetRows({
        auth: commons.getOauth2Client(context.auth),
        spreadsheetId: sheetId,
        range: encodeURIComponent(worksheetName),
        majorDimension: 'ROWS',
        dateTimeRenderOption: 'FORMATTED_STRING',
        valueRenderOption: 'UNFORMATTED_VALUE'
    });

    return response['values'] || [];
}

/**
 * Runs periodically to fetch sheet rows
 * and compare them for change
 */
module.exports = {

    async tick(context) {

        const {
            withHeaders,
            rowFormat,
            allAtOnce
        } = context.properties;

        const currentRows = await fetchSheetRows(context);
        let changed = [];
        if (!context.state.rows) {
            await context.saveState({ rows: currentRows });
        }
        const previousRows = context.state.rows ? context.state.rows : currentRows;

        if (currentRows.length < 20) {
            changed = getChangedRows(
                currentRows,
                previousRows,
                withHeaders,
                rowFormat
            );
        } else {
            changed = await context.execOnWorker(getChangedRows, [
                currentRows,
                previousRows,
                withHeaders,
                rowFormat
            ]);
        }

        if (changed.length) {
            await context.saveState({ rows: currentRows });
        } else {
            return false;
        }

        if (allAtOnce) {
            return context.sendJson({ rows: changed }, 'out');
        }

        for (const change of changed) {
            const { row, index } = change;
            await context.sendJson({ row, index }, 'out');
        }
    },

    // Flow Test Mode: emit the newest row mapped exactly the way tick() maps a changed row.
    // tick() suppresses its first run while seeding state.rows, so test() fetches rows directly
    // and reuses the SAME getChangedRows() mapping (treating the latest row as "changed" by
    // diffing against the rows without it). Read-only, no state writes.
    async test(context) {

        const { withHeaders, rowFormat, allAtOnce } = context.properties;

        const currentRows = await fetchSheetRows(context);
        if (!currentRows.length) {
            throw new Error('No rows available in the worksheet to use as test data.');
        }

        // Mark only the last row as changed by comparing against the rows without it.
        const previousRows = currentRows.slice(0, -1);
        const changed = getChangedRows(currentRows, previousRows, withHeaders, rowFormat);

        if (!changed.length) {
            throw new Error('No rows available in the worksheet to use as test data.');
        }

        if (allAtOnce) {
            return context.sendJson({ rows: changed }, 'out');
        }

        const { row, index } = changed[changed.length - 1];
        return context.sendJson({ row, index }, 'out');
    }
};
