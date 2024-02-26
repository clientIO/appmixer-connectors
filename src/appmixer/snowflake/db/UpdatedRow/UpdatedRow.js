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

    async tick(context) {

        const { schema, table } = context.properties;
        const data = await snowflake.consumeStream(context, schema, table, 'update');
        const mid = data.length / 2
        for (let i = 0; i < mid; i++) {

            const { METADATA$ACTION: oldAction, METADATA$ISUPDATE: oldUpdate, METADATA$ROW_ID: oldId, ...oldRow } = data[i + mid];
            const { METADATA$ACTION: updatedAction, METADATA$ISUPDATE: updatedUpdate, METADATA$ROW_ID: updatedId, ...updatedRow } = data[i];
            await context.sendJson({ oldRow, updatedRow }, 'out');
        }
    }
};
