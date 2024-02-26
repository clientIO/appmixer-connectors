'use strict';
const commons = require('../../google-commons');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { loadFile } = require('../common');

/**
 * @param {Context} context
 * @param sheet
 * @param csvHeader
 * @param {boolean} append
 * @param autoMatch
 * @param {Array<{column: string}>} [defineColumns]
 * @param {Array<{column: string, value: string}>} [newColumns]
 * @returns {Promise<{csvColumnMap: {}, spreadsheetHeader: *[]}>}
 */
async function setWorksheetHeader(context, sheet, csvHeader, append, autoMatch, defineColumns, newColumns = []) {

    let headerRow;
    if (autoMatch) {
        await sheet.loadHeaderRow();
        headerRow = sheet.headerValues;

        if (autoMatch && !headerRow) {
            // the best would be to show this error in the UI before the flow is started, but right now there is no
            // way, there would have to be a possibility to return a validation error for the `autoMatch` input,
            // to call a custom function with the spreadsheet that would check the header row.
            throw new context.CancelError('Missing header row in the Spreadsheet.');
        }
    } else {
        if (!defineColumns) throw new context.CancelError(`The 'defineColumns' parameter cannot be empty.`);
        headerRow = defineColumns;
    }

    const csvColumnMap = {};
    const newHeader = [...headerRow];

    csvHeader.forEach((column, index) => {
        const headerIndex = headerRow.indexOf(column);
        if (headerIndex !== -1) {
            csvColumnMap[index] = column;
        } else if (append) {
            newHeader.push(column);
            csvColumnMap[index] = column;
        }
    });

    newColumns.forEach(column => {
        if (newHeader.indexOf(column.column) === -1) {
            newHeader.push(column.column);
        }
    });

    await sheet.setHeaderRow(newHeader);
    return csvColumnMap;
}

/**
 * Prepare data for the new rows. It takes the source CSV row, mapping of columns and new columns that the user wants
 * to add to the spreadsheet.
 * @param row
 * @param mappedRow
 * @param {Array<{ column: string, value: string }>} [newColumns]
 * @returns {{}}
 */
function processEachRow(row, mappedRow, newColumns = []) {

    let newRow = {};
    row.forEach((value, index) => {
        if (!mappedRow[index]) {
            return;
        }
        newRow[mappedRow[index]] = value;
    });

    newColumns.forEach(column => {
        newRow[column.column] = column.value;
    });

    return newRow;
}

async function getWorksheet(context, sheetId, worksheetId) {

    const doc = new GoogleSpreadsheet(sheetId);
    doc.useOAuth2Client(commons.getAuthLibraryOAuth2Client(context.auth));
    await doc.loadInfo();
    return doc.sheetsById[worksheetId.split('/')[0]];
}

async function appendRowsToSheet(sheet, rows) {

    return await sheet.addRows(rows, { insert: true });
}

async function generateInspector(context) {

    const inspector = {
        schema: {
            properties: {
                sheetId: {
                    type: 'string'
                },
                worksheetId: {
                    type: 'string'
                },
                fileId: {
                    type: 'string'
                },
                fileUrl: {
                    type: 'string'
                },
                delimiter: {
                    type: 'string'
                },
                append: {
                    type: 'boolean'
                }
            },
            oneOf: [
                { required: ['fileUrl'] },
                { required: ['fileId'] }
            ],
            required: ['sheetId', 'worksheetId']
        },
        inputs: {
            sheetId: {
                type: 'select',
                index: 1,
                label: 'Spreadsheet',
                source: {
                    url: '/component/appmixer/google/spreadsheets/ListSheets?outPort=out',
                    data: {
                        transform: './ListSheets#sheetsToSelectArray'
                    }
                },
                tooltip: 'Select spreadsheet.'
            },
            worksheetId: {
                type: 'select',
                index: 2,
                label: 'Worksheet',
                source: {
                    url: '/component/appmixer/google/spreadsheets/ListWorksheets?outPort=out',
                    data: {
                        properties: {
                            sheetId: 'inputs/in/sheetId'
                        },
                        transform: './ListWorksheets#worksheetsToSelectArray'
                    }
                },
                tooltip: 'Select a worksheet with a header row in the sheet.'
            },
            fileId: {
                type: 'filepicker',
                index: 3,
                label: 'File ID',
                tooltip: 'A CSV File ID assigned to file once stored in this application or select a file from your computer.'
            },
            fileUrl: {
                type: 'text',
                index: 4,
                label: 'File URL',
                tooltip: 'Type or paste file URL (with http://, https://).'
            },
            delimiter: {
                type: 'text',
                label: 'Delimiter',
                index: 5,
                defaultValue: ',',
                tooltip: 'Character to use as a delimiter between columns.'
            },
            append: {
                type: 'toggle',
                label: 'Append',
                defaultValue: true,
                index: 6,
                tooltip: 'If true, then columns from the input file, that cannot be found in the Spreadsheet will be appended behind the last column found in the Spreadsheet. If false, then columns from the input file that do not exist in the Spreadsheet won\'t be used at all.'
            },
            autoMatch: {
                type: 'toggle',
                label: 'Auto match columns',
                defaultValue: true,
                index: 7,
                tooltip: 'If true, then a header row has to exists in the Spreadsheet, that row will be used to match header from the input file.'
            },
            defineColumns: {
                type: 'expression',
                label: 'Define columns',
                minItems: 1,
                index: 8,
                levels: ['ADD'],
                when: { eq: { './autoMatch': false } },
                tooltip: 'Can be used to define columns in the Spreadsheet.',
                fields: {
                    column: {
                        type: 'text',
                        index: 1,
                        label: 'Name',
                        required: true,
                        tooltip: 'Column with this name will be created in the Spreadsheet and then used to match a column with the same name in the source file. If such a column already exists in the Spreadsheet, it will not be created again.'
                    }
                }
            },
            newColumns: {
                type: 'expression',
                label: 'New columns',
                index: 9,
                levels: ['ADD'],
                tooltip: 'These columns will be created in the Spreadsheet behind the last existing column. ',
                fields: {
                    column: {
                        type: 'text',
                        index: 1,
                        label: 'Name',
                        tooltip: 'Name of the new column that will be created in the Spreadsheet. If such a column already exists, it will not be created again.'
                    },
                    value: {
                        type: 'text',
                        index: 2,
                        label: 'Value',
                        tooltip: 'Value that will be used to fill the column (this will be applied to every row). If the column with the same name exists in the input file, the value you specify here will be used for every row, not the value from the input field.'
                    }
                }
            }
        }
    };

    if (context.properties.autoMatch === false) {
        inspector.schema.properties.defineColumns = {
            type: 'object',
            properties: {
                ADD: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            column: {
                                type: 'string',
                                minLength: 1
                            }
                        },
                        required: [
                            'column'
                        ]
                    },
                    minItems: 1
                }
            }
        };
        inspector.schema.required.push('defineColumns');
    }

    return context.sendJson(inspector, 'out');
}

module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const { sheetId, worksheetId, fileId, fileUrl, delimiter, append, autoMatch } = context.messages.in.content;
        const batchSize = context.config.batchSize || 10000;
        const fileSource = fileId || fileUrl;

        let values = [];
        let response = {};
        let rowCount = 0;
        let totalNewRows = 0;
        let newColumns = [];
        let defineColumns = [];
        let csvColumnMap = {};

        if (context.messages.in.content?.newColumns?.ADD) {
            newColumns = context.messages.in.content.newColumns.ADD;
        }
        if (context.messages.in.content?.defineColumns?.ADD) {
            defineColumns = context.messages.in.content.defineColumns.ADD.map(item => item.column);
        }

        const sheet = await getWorksheet(context, sheetId, worksheetId);
        if (!sheet) {
            throw new context.CancelError(`Worksheet ${worksheetId} not found.`);
        }

        const lastSentIndexCache = await context.stateGet(context.id);

        if (lastSentIndexCache) {
            rowCount += lastSentIndexCache.index;
            csvColumnMap = lastSentIndexCache.csvColumnMap;
        } else {
            const csvHeader = (await loadFile(context, fileSource, delimiter, true).next())?.value;
            if (!csvHeader) {
                throw new context.CancelError('No header found in the source file.');
            }
            csvColumnMap = await setWorksheetHeader(context, sheet, csvHeader, append, autoMatch, defineColumns, newColumns);
        }

        // I'm thinking about locking the receive(), what if the upload takes more than 25 minutes (default
        // receive() timeout), then the InputQueue will trigger an error - receive() timed out, but the function
        // may still be running and uploading. In a minute, the system will trigger a retry, and it could start
        // creating duplicated rows - I mean, it would read the lastSentIndexCache.index, so it would not
        // duplicate rows already created, but the batch `in progress` could be processed 2x.
        // On the other hand, what the lock TTL should be? should not be set too high, should be extended
        // after each batch is sent to the output port

        await context.log({ start: new Date(), fileSource });

        for await (const row of loadFile(context, fileSource, delimiter, false, 1)) {
            rowCount++;
            values.push(processEachRow(row, csvColumnMap, newColumns));

            if (rowCount % batchSize === 0) {
                try {
                    response = await appendRowsToSheet(sheet, values);
                } catch (err) {
                    delete err?.config;   // contains the cells
                    delete err?.response?.config;   // contains the cells
                    if (err?.message?.includes('Google API error - [400] This action would increase the number of cells in the workbook above the limit')) {
                        throw new context.CancelError(err.message, err.response.data);
                    }
                    throw err;
                }
                if (lastSentIndexCache?.newRows) totalNewRows += lastSentIndexCache?.newRows;

                totalNewRows += response.length || 0;
                values = [];  // Clear the array for the next batch
                await context.stateSet(context.id, {
                    index: rowCount,
                    newRows: totalNewRows,
                    csvColumnMap
                });
            }
        }

        if (values.length > 0) {
            // Append any remaining rows to the sheet
            response = await appendRowsToSheet(sheet, values);
        }

        await context.sendJson({
            spreadsheetId: sheetId,
            newRows: totalNewRows + response.length || 0
        }, 'out');

        return context.stateUnset(context.id);
    }
};
