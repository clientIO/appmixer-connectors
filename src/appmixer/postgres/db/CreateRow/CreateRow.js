'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

const CONNECTIONS = {};

module.exports = {

    async receive(context) {

        const row = context.messages.row.content;
        const columns = Object.keys(row);
        const values = Object.values(row);
        const valuesMarkers = columns.map((col, index) => '$' + (index + 1));

        let query = `INSERT INTO ${context.properties.table}(${columns.join(',')}) VALUES(${valuesMarkers.join(',')}) RETURNING *`;

        let client = await connect(context);
        try {
            let res = await client.query(query, values);
            await context.sendJson(res.rows[0], 'newRow');
        } finally {
            await client.release();
        }
    },

    async stop(context) {

        const connectionId = connectionHash(context.auth);
        if (CONNECTIONS[connectionId]) {
            await CONNECTIONS[connectionId].end();
        }
    }
};

function connectionHash(auth) {

    const authString = JSON.stringify(auth);
    return crypto.createHash('md5').update(authString).digest('hex');
};

async function connect(context) {

    const connectionId = connectionHash(context.auth);
    if (CONNECTIONS[connectionId]) {
        return CONNECTIONS[connectionId].connect();
    }

    const pool = CONNECTIONS[connectionId] = new Pool({
        user: context.auth.dbUser,
        host: context.auth.dbHost,
        database: context.auth.database,
        password: context.auth.dbPassword,
        port: context.auth.dbPort,
        poolSize: context.config.CreateRowPoolSize || 1
    });

    return pool.connect();
}
