'use strict';

const { SnowflakeDB } = require("../../common");
const snowflake = new SnowflakeDB()
module.exports = {

    async start(context) {

        const { schema, table } = context.properties;
        await snowflake.createStream(context, schema, table);
    },

    async stop(context) {

        const { schema, table } = context.properties;
        await snowflake.dropStream(context, schema, table);
    },

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }
    },

    async tick(context) {

        const { schema, table } = context.properties;
        const data = await snowflake.consumeStream(context, schema, table, 'delete');
        // await context.sendJson({ oldRow: data, updatedRow: data[0] }, 'out');
        for (const row of data) {
            await context.sendJson({ row }, 'out');
        }
    },

    async getOutputPortOptions(context) {

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
