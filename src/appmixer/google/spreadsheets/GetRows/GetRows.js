'use strict';
const google = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const sheets = google.sheets('v4');
const getRows = Promise.promisify(sheets.spreadsheets.values.get, { context: sheets.spreadsheets.values });

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            if (context.messages.in.content.allAtOnce) {
                return context.sendJson([{ label: 'Rows', value: 'rows' }], 'out');
            }
            if (context.messages.in.content.withHeaders === true
                && context.messages.in.content.rowFormat === 'object') {
                const columns = await context.componentStaticCall('appmixer.google.spreadsheets.ListColumns', 'out', {
                    properties: {
                        sheetId: context.messages.in.content.sheetId,
                        worksheetId: context.messages.in.content.worksheetId
                    },
                    transform: './ListColumns#columnsToSelectArray'
                });

                let output = [
                    {
                        label: 'Index',
                        value: 'index'
                    },
                    {
                        label: 'Row object',
                        value: 'row'
                    }
                ];

                columns.forEach(column => {
                    output.push({
                        label: column.label,
                        value: `row.${column.value}`
                    });
                });

                return context.sendJson(output, 'out');
            }

            return context.sendJson([
                {
                    label: 'Index',
                    value: 'index'
                },
                {
                    label: 'Row',
                    value: 'row'
                }
            ], 'out');
        }

        const {
            sheetId,
            worksheetId,
            withHeaders,
            rowFormat,
            allAtOnce
        } = context.messages.in.content;

        const [, worksheetName] = worksheetId.split('/');

        const response = await getRows({
            auth: commons.getOauth2Client(context.auth),
            spreadsheetId: sheetId,
            range: worksheetName,
            majorDimension: 'ROWS'
        });
        let rows = response['values'] || [];

        if (withHeaders && rowFormat === 'object') {
            const headerRow = rows.shift() || [];
            rows = rows.map(
                row => row.reduce((rowObject, cell, index) => {
                    const header = headerRow[index] || index;
                    rowObject[header] = cell;
                    return rowObject;
                }, {})
            );
        }
        if (allAtOnce) {
            return context.sendJson({ rows }, 'out');
        }

        let index = 0;
        for (let row of rows) {
            await context.sendJson({ index: index++, row }, 'out');
        }
    }
};
