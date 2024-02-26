'use strict';
const { SnowflakeDB } = require('../../common');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        if (context.properties.generateInspector) {

            let subInspector = {};
            if (context.properties.schema && context.properties.table) {
                subInspector = await context.componentStaticCall('appmixer.snowflake.db.ListColumns', 'out', {
                    messages: {
                        in: {
                            schema: context.properties.schema,
                            table: context.properties.table
                        }
                    },
                    transform: './ListColumns#columnsToInspector'
                });
            }

            const inspector = {
                schema: {
                    properties: {
                        schema: {
                            type: 'string'
                        },
                        table: {
                            type: 'string'
                        }
                    },
                    required: ['schema', 'table']
                },
                inputs: {
                    schema: {
                        type: "select",
                        label: "Schema",
                        index: 1,
                        source: {
                            url: "/component/appmixer/snowflake/db/ListSchemas?outPort=schemas",
                            data: {
                                properties: {
                                    sendWholeArray: true
                                },
                                transform: "./ListSchemas#schemasToSelectArray"
                            }
                        },
                        tooltip: "Select a schema."
                    },
                    table: {
                        type: "text",
                        index: 2,
                        label: "Table",
                        source: {
                            url: "/component/appmixer/snowflake/db/ListTables?outPort=tables",
                            data: {
                                properties: {
                                    sendWholeArray: true
                                },
                                messages: {
                                    "in/schema": "inputs/in/schema"
                                },
                                transform: "./ListTables#tablesToSelectArray"
                            }
                        },
                        tooltip: "Select a table."
                    }
                }
            };

            return context.sendJson({
                schema: Object.assign(subInspector?.schema || {}, inspector.schema),
                inputs: Object.assign(subInspector?.inputs || {}, inspector.inputs),
                groups: subInspector?.groups || {}
            }, 'out');
        }

        const { schema, table, ...columnValues } = context.messages.in.content;

        const snowflake = new SnowflakeDB()
        const row = await snowflake.addRow(context.auth, schema, table, Object.keys(columnValues), Object.values(columnValues));
        return context.sendJson({ row: columnValues }, 'out');
    },

    async getOutputPortOptions(context) {

        let subInspector = {};
        const { schema, table } = context.messages.in.content;

        if (schema && table) {
            subInspector = await context.componentStaticCall('appmixer.snowflake.db.ListColumns', 'out', {
                messages: {
                    in: {
                        schema,
                        table
                    }
                },
                transform: './ListColumns#columnsToInspector'
            });
        }
        const options = [{
            label: 'Row',
            value: 'row'
        }];
        for (const key in subInspector.inputs) {
            options.push(
                {
                    label: `Row.${key}`,
                    value: `row.${key}`
                }
            )
        }
        return context.sendJson(options, 'out');
    }
};
