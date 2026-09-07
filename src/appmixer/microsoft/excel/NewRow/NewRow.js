'use strict';
const request = require('request-promise');
const Promise = require('bluebird');

function filledCells(result, value) {

    if (result) {
        return value && value !== '' && typeof value !== 'undefined';
    }

    return false;
}

/**
 * Process rows to find newly added.
 * @param {Set} knownRows
 * @param {Array} currentRows
 * @param {Array} newRows
 * @param {Object}  options
 * @param {boolean}  options.fullRowOnly
 * @param {{
 *        rowIndex: number,
 *        columnIndex: number,
 *        columnCount: number
 *        }}  options.range
 * @param {Array} row
 * @param {number} index
 */
function processRows(knownRows, currentRows, newRows, options, row, index) {

    const { fullRowOnly, range } = options;
    const { rowIndex: rowIndexBase, columnIndex/*, columnCount*/ } = range;

    const rowIndex = rowIndexBase + index;
    const rowId = columnIndex + '|' + rowIndex;

    const rowItem = {
        partial: !row.reduce(filledCells, true)
    };

    if (knownRows) {
        const knownItem = knownRows.get(rowId);
        if (knownItem) {
            rowItem.sent = knownItem.sent;
        }
        if (fullRowOnly) {
            if (!rowItem.partial && (!knownItem || (knownItem.partial && !knownItem.sent))) {
                rowItem.sent = true;
                newRows.push(row);
            }
        } else {
            if (!knownItem) {
                rowItem.sent = true;
                newRows.push(row);
            }
        }
    } else {
        // initial state, so we assume items which are in the sheet were already processed
        // NOTE: this could change in future,
        // where we can add toggle for processing ALL previus items (from certain point)
        rowItem.sent = true;
    }

    currentRows.push([rowId, rowItem]);
}

/**
 * Creates result JSON representation of the row
 * @param  {Array<*>} row
 * @param  {number} baseIndex of column
 * @return {Object}
 */
function createRowItem(row, baseIndex) {

    const result = {};
    for (let i = 0; i < row.length; i++) {
        result['c' + (baseIndex + i)] = row[i];
    }

    return result;
}

/**
 * Fetch the used range of a worksheet. Shared by tick() and test() so both
 * issue the exact same request and operate on identical range data.
 * @param {Context} context
 * @return {Promise<Object>} the Graph used-range object
 */
async function fetchUsedRange(context) {

    const { sheetId, worksheetId } = context.properties;
    const maxRange = 'A1:ZZ5000';
    const { accessToken } = context.auth;
    const url = `https://graph.microsoft.com/v1.0/me/drive/items/${sheetId}` +
        `/workbook/worksheets/${worksheetId}/range(address='${maxRange}')/usedrange`;

    // FIX: ULTRA HACK!
    // From time to time, Graph API returns somehow truncated range! (some rows missing)
    // there is no pattern for that behavior and no reason whatsoever..
    // this behavior seriously messes the logic behind new/change row detection!
    // this is attempt to negate that flaw
    let rowCount = -1;
    let range = {};
    do {
        rowCount = range.rowCount;
        range = await request({
            method: 'GET',
            url,
            qs: {
                valuesOnly: true
            },
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });
    } while (range.rowCount !== rowCount);

    return range;
}

module.exports = {

    async tick(context) {

        const { fullRowOnly = false } = context.properties;

        const range = await fetchUsedRange(context);

        // uncomment if we want raw values
        // const { values: data } = range;
        const { text: data } = range;
        const known = Array.isArray(context.state.known) ? new Map(context.state.known) : null;
        const current = [];
        const diff = [];

        const options = {
            range,
            fullRowOnly
        };

        data.forEach(processRows.bind(null, known, current, diff, options));

        await Promise.map(diff, row => {
            return context.sendJson(createRowItem(row, range.columnIndex), 'out');
        });

        await context.saveState({ known: current });
    },

    async test(context) {

        const { fullRowOnly = false } = context.properties;

        // Flow Test Mode: use the same range fetch + createRowItem mapping tick()
        // uses, but WITHOUT the state baseline (which on first run marks every
        // existing row as already-seen and emits nothing). Emit the last
        // (newest) row instead so the test produces a realistic item.
        const range = await fetchUsedRange(context);
        const { text: data } = range;

        if (!Array.isArray(data) || !data.length) {
            throw new Error('No rows found in the worksheet to use as test data.');
        }

        // Walk from the bottom up to find the newest usable row. When fullRowOnly
        // is set, mirror tick()'s filter and only accept a fully-filled row.
        let selected = null;
        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];
            const partial = !row.reduce(filledCells, true);
            if (fullRowOnly && partial) {
                continue;
            }
            selected = row;
            break;
        }

        if (!selected) {
            throw new Error('No complete rows found in the worksheet to use as test data.');
        }

        return context.sendJson(createRowItem(selected, range.columnIndex), 'out');
    }
};
