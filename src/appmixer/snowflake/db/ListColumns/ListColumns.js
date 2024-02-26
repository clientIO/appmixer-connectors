'use strict';

const { SnowflakeDB } = require("../../common");

const snowflake = new SnowflakeDB();

module.exports = {
    async receive(context) {

        const { schema, table } = context.messages.in.content;
        const columns = await snowflake.listColumns(context.auth, schema, table);
        return context.sendJson({ columns }, 'out');
    },
    columnsToSelectArray({ columns }) {

        return columns.map(column => {
            return { label: column.column_name, value: column.column_name };
        });
    },
    columnsToInspector({ columns }) {

        if (!columns) {
            throw new Error('There is not a header row.');
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

                inspector.inputs[column.column_name] = {
                    type: 'text',
                    label: column.column_name,
                    group: 'columns'
                };
            });
        }
        return inspector;
    }
};
