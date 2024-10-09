'use strict';
const { Client } = require('pg');

module.exports = {

    async receive(context) {

        // See https://www.postgresql.org/docs/8.0/infoschema-columns.html
        const query = `SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${context.properties.table}'`;

        const client = new Client({
            user: context.auth.dbUser,
            host: context.auth.dbHost,
            database: context.auth.database,
            password: context.auth.dbPassword,
            port: context.auth.dbPort
        });

        await client.connect();

        try {
            let res = await client.query(query);
            await context.sendJson(res.rows, 'columns');
        } finally {
            await client.end();
        }
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

    columnsToInspector(columns) {

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
    }
};
