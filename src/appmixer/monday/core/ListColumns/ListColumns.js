'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

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

    return nullOrEmpty(column) ? 'column' + index : column.title;
}

/**
 * Component for fetching list of columns.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const data = await commons.makeRequest({
            query: queries.listColumns,
            options: {
                variables: { boardId: +(context.messages.in.content.boardId) }
            },
            apiKey: context.auth.apiKey
        });
        const columns = data.boards[0] && data.boards[0].columns;
        return context.sendJson({ columns }, 'out');
    },

    columnsToSelectArray({ columns }) {

        return columns.map(column => {
            return { label: column.title, value: column.id };
        });
    },

    columnsToInspector({ columns }) {

        if (!columns) {
            throw new Error('There are no columns in the board.');
        }

        // creating inspector template based on: http://jointjs.com/rappid/docs/ui/inspector
        let inspector = {
            inputs: {},
            groups: {
                columns: { label: 'Columns', index: 1 }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column, i) => {
                if (column.type === 'name') return;
                const index = i + 1;
                inspector.inputs[column.id] = {
                    type: 'text',
                    label: columnName(column, index),
                    group: 'columns'
                };
            });
        }

        return inspector;
    }
};

