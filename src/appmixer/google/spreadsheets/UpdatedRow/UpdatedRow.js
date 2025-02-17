'use strict';
const google = require('googleapis');
const Promise = require('bluebird');
const commons = require('../../google-commons');

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
            rowWithHeader[headerCell] = dataRow[cellIndex] || '';
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

/**
 * Runs periodically to fetch sheet rows
 * and compare them for change
 */
module.exports = {

    async tick(context) {

        const {
            sheetId,
            worksheetId,
            withHeaders,
            rowFormat,
            allAtOnce
        } = context.properties;

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

        const currentRows = response['values'] || [];
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
    }
};
