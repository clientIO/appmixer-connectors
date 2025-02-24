'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        // See https://www.postgresql.org/docs/8.0/infoschema-columns.html

        let [schema, table] = context.properties.table.split('.');
        if (!table) {
            table = schema;
            schema = 'public';
        }

        const query = `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${schema}' and table_name = '${table}'`;
        await context.log({ step: 'query', query });

        let res;
        try {
            res = await lib.query(context, query);
        } finally {
            await lib.disconnect(context);
        }
        return context.sendJson(res.rows, 'columns');
    },

    columnsToSelectArray(columns) {

        let transformed = [];

        if (Array.isArray(columns)) {
            columns.forEach(column => {
                transformed.push({
                    label: column['column_name'],
                    value: column['column_name']
                });
            });
        }

        return transformed;

    },

    columnsToInspectorCreate(columns) {

        let inspector = {
            schema: {
                type: 'object',
                required: []
            },
            inputs: {},
            groups: {
                columns: { label: 'Columns', index: 1 }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column) => {
                const name = column['column_name'];

                // See https://www.postgresql.org/docs/9.5/datatype.html for all data types.
                const type = ({
                    'bigint': 'number',
                    'boolean': 'toggle',
                    'double precision': 'number',
                    'integer': 'number',
                    'numeric': 'number',
                    'decimal': 'number',
                    'real': 'number',
                    'smallint': 'number'
                })[column['data_type']] || 'text';

                inspector.inputs[name] = {
                    type: type,
                    label: name,
                    group: 'columns',
                    index: column['ordinal_position']
                };

                if (column['is_nullable'] === 'NO' && column['column_default'] === null) {
                    // For example serial type is nullable but has a column_default set
                    // to: 'nextval(\'shifts_id_seq\'::regclass)'.
                    // We do not return the field as required since the same ListColumns is also
                    // used in UpdateRow component which does not require any field to have a value.
                    // Instead, we add the information to the tooltip.
                    inspector.inputs[name].tooltip = 'This field is required since it is not nullable and does not have a default value.';
                }
            });
        }

        return inspector;
    },

    columnsToInspectorUpdate(columns) {

        let inspector = {
            schema: {
                type: 'object',
                required: []
            },
            inputs: {},
            groups: {
                columns: { label: 'Columns', index: 1 }
            }
        };

        if (Array.isArray(columns) && columns.length > 0) {
            columns.forEach((column) => {
                const name = column['column_name'];

                // See https://www.postgresql.org/docs/9.5/datatype.html for all data types.
                const type = ({
                    'bigint': 'number',
                    'boolean': 'toggle',
                    'double precision': 'number',
                    'integer': 'number',
                    'numeric': 'number',
                    'decimal': 'number',
                    'real': 'number',
                    'smallint': 'number'
                })[column['data_type']] || 'text';

                inspector.inputs[name] = {
                    type: type,
                    label: name,
                    group: 'columns',
                    index: column['ordinal_position']
                };
            });
        }

        return inspector;
    }
};
