'use strict';
const { SnowflakeDB } = require('../../common');

module.exports = {

    async receive(context) {
        const snowflake = new SnowflakeDB()
        const schemas = await snowflake.listSchemas(context.auth);
        return context.sendJson({ schemas }, 'schemas');
    },
    schemasToSelectArray({ schemas }) {

        return schemas.map(schema => {
            return { label: schema.name, value: schema.name };
        });
    }
};

