'use strict';
const { SnowflakeDB } = require('../../common');

module.exports = {

    async receive(context) {
        const { schema } = context.messages.in.content;
        const snowflake = new SnowflakeDB()
        const tables = await snowflake.listTables(context.auth, schema);
        return context.sendJson({ tables }, 'tables');
    },
    tablesToSelectArray({ tables }) {

        return tables.map(table => {
            return { label: table.name, value: table.name };
        });
    }
};
