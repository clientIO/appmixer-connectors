'use strict';
const { Pool } = require('pg');

module.exports = {

    async connect(context) {

        if (this.pool) {
            return this.pool.connect();
        }

        this.pool = new Pool({
            user: context.auth.dbUser,
            host: context.auth.dbHost,
            database: context.auth.database,
            password: context.auth.dbPassword,
            port: context.auth.dbPort,
            poolSize: context.properties.poolSize || 1
        });

        return this.pool.connect();
    },

    async receive(context) {

        const row = context.messages.row.content;
        const columns = Object.keys(row);
        const values = Object.values(row);
        const valuesMarkers = columns.map((col, index) => '$' + (index + 1));

        let query = `INSERT INTO ${context.properties.table}(${columns.join(',')}) VALUES(${valuesMarkers.join(',')}) RETURNING *`;

        let client = await this.connect(context);
        try {
            let res = await client.query(query, values);
            await context.sendJson(res.rows[0], 'newRow');
        } finally {
            await client.release();
        }
    },

    async stop(context) {

        if (this.pool) {
            await this.pool.end();
        }
    }
};
