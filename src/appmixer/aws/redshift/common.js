const { Pool } = require('pg');
const QueryStream = require('pg-query-stream');

async function createConnection(context) {

    const pool = new Pool({
        user: context.dbUser,
        host: context.dbHost,
        database: context.database,
        password: context.dbPassword,
        port: context.dbPort || 5439,
        max: 10,
        idleTimeoutMillis: 30000,
        ssl: {
            rejectUnauthorized: true
        }
    });
    return pool;
}

async function runQuery({ context, query, stream = false, params = [] }) {

    const pool = await createConnection(context);

    if (stream) {
        const client = await pool.connect();
        try {
            const queryStream = new QueryStream(query, params);
            const stream = client.query(queryStream);
            stream.on('end', () => client.release());
            return stream;
        } catch (error) {
            client.release();
            throw error;
        }
    } else {
        const res = await pool.query(query, params);
        await pool.end();
        return res;
    }
}

module.exports = {
    createConnection,
    runQuery
};
