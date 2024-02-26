'use strict';
const request = require('request-promise');

module.exports = {

    async receive(context) {

        const { sheetId, worksheetId } = context.properties;
        const maxRange = 'A1:ZZ100';
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${sheetId}` +
        `/workbook/worksheets/${worksheetId}/range(address='${maxRange}')/usedrange`;

        const { accessToken } = context.auth;
        const usedrange = await request({
            method: 'GET',
            url,
            auth: { bearer: accessToken },
            headers: { 'Accept': 'application/json' },
            json: true
        });

        return context.sendJson(usedrange, 'out');
    },

    columnsToSelectArray(columns) {

        const transformed = [];
        if (Array.isArray(columns.values)) {
            const firstColumn = columns.values[0] || [];
            const firstColumnIndex = columns.columnIndex;
            for (var i = 0; i < columns.columnCount; i++) {

                const value = 'c' + (firstColumnIndex + i);
                transformed.push({
                    label: firstColumn[i] || value,
                    value
                });
            }
        }
        return transformed;
    },

    columnsToInspector(columns) {

        // creating inspector template based on: http://jointjs.com/rappid/docs/ui/inspector
        const inputs = {};
        const inspector = {
            inputs,
            groups: {
                columns: { label: 'Columns' }
            }
        };

        if (Array.isArray(columns.values)) {
            const firstColumn = columns.values[0] || [];
            const firstColumnIndex = columns.columnIndex;

            for (var i = 0; i < columns.columnCount; i++) {

                const value = 'c' + (firstColumnIndex + i);

                inputs[value] = {
                    type: 'text',
                    label: firstColumn[i] || value,
                    group: 'columns'
                };
            }
        }
        return inspector;
    }
};
