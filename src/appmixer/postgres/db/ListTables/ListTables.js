'use strict';
const { Client } = require('pg');

module.exports = {

    async receive(context) {

        const query = 'SELECT * FROM pg_catalog.pg_tables WHERE schemaname != \'pg_catalog\' AND schemaname != \'information_schema\'';

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
            await context.sendJson(res.rows, 'tables');
        } finally {
            await client.end();
        }
    },

    toSelectArray(tables) {

        let transformed = [];

        if (Array.isArray(tables)) {
            tables.forEach(table => {
                transformed.push({
                    label: table['tablename'],
                    value: table['tablename']
                });
            });
        }

        return transformed;
    }
};

