'use strict';
const { getHeader } = require('../common');

/**
 * Helper function - returns true, if value is null or empty
 * @param  {*} value
 * @return {boolean}
 */
function nullOrEmpty(value) {

    return !value && value !== 0
        || typeof value === 'string' && value.trim() === ''
        || Array.isArray(value) && value.length === 0
        || typeof value === 'object' && Object.keys(value).length === 0;
}


function columnName(column, index) {

    return nullOrEmpty(column) ? 'column' + index : column;
}

/**
 * ListColumns.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { sheetId, worksheetId } = context.properties;
        const columns = await getHeader(context, sheetId, worksheetId);
        return context.sendJson(columns, 'out');
    },

    columnsToSelectArray(columns) {

        let transformed = [];
        if (Array.isArray(columns)) {
            columns.forEach((column, i) => {
                const name = columnName(column, i + 1);
                transformed.push({
                    label: name,
                    value: name
                });
            });
        }

        return transformed;
    },

    columnsToInspector(columns) {

        if (!columns) {
            return;
        }

        let inspector = {
            inputs: {},
            groups: {
                columns: { label: 'Columns', index: 1 }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column, i) => {
                const index = i + 1;
                inspector.inputs[columnName(column, index)] = {
                    type: 'select',
                    label: columnName(column, index),
                    group: 'columns',
                    index,
                    source: {
                        url: '/component/appmixer/google/spreadsheets/ListColumnsFromCsvFile?outPort=out',
                        data: {
                            messages: {
                                'in/fileId': 'inputs/in/fileId',
                                'in/delimiter': 'inputs/in/delimiter'
                            },
                            transform: './ListColumnsFromCsvFile#columnsToSelectArray'
                        }
                    }
                };
            });
        }

        return inspector;
    }
};
