'use strict';

const { Pool } = require('pg');
const crypto = require('crypto');

const CONNECTIONS = {};

module.exports = {

    async receive(context) {

        const filter = context.messages.in.content.filter;
        let where = '';
        const whereConditionsAnd = [];

        filter.AND.forEach(expressionAnd => {

            const whereConditionsOr = [];

            expressionAnd.OR.forEach(expressionOr => {

                const { column, operator, value } = expressionOr;
                let whereCondition = '';
                if (operator === 'CONTAINS') {
                    whereCondition += `${column} LIKE '%${value}%'`;
                } else if (operator === 'NOT CONTAINS') {
                    whereCondition += `${column} NOT LIKE '%${value}%'`;
                } else if (operator === 'STARTS WITH') {
                    whereCondition += `${column} LIKE '${value}%'`;
                } else if (operator === 'NOT STARTS WITH') {
                    whereCondition += `${column} NOT LIKE '%${value}'`;
                } else if (operator === 'ENDS WITH') {
                    whereCondition += `${column} LIKE '%${value}'`;
                } else if (operator === 'NOT ENDS WITH') {
                    whereCondition += `${column} NOT LIKE '%${value}'`;
                } else if (operator === 'IN') {
                    whereCondition += `${column} IN (${value.trim().split(',').map(v => `'${v}'`).join(',')})`;
                } else if (operator === 'NOT IN') {
                    whereCondition += `${column} NOT IN (${value.trim().split(',').map(v => `'${v}'`).join(',')})`;
                } else if (operator === 'IS NULL') {
                    whereCondition += `${column} IS NULL`;
                } else if (operator === 'IS NOT NULL') {
                    whereCondition += `${column} IS NOT NULL`;
                } else {
                    whereCondition += `${column} ${operator} '${value}'`;
                }
                whereConditionsOr.push(whereCondition);
            });

            whereConditionsAnd.push('(' + whereConditionsOr.join(' OR ') + ')');
        });

        where = whereConditionsAnd.join(' AND ');

        let query = `DELETE FROM ${context.properties.table} WHERE ${where}`;
        await context.log({ step: 'query', query });

        let client = await connect(context);
        try {
            let res = await client.query(query);
            await context.sendJson({ rowCount: res.rowCount }, 'out');
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
