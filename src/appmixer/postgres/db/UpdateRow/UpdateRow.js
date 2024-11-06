'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const row = context.messages.row.content;
        const filter = row.filter;
        delete row['filter'];
        const columns = Object.keys(row);
        const values = Object.values(row);
        const set = columns.map((col, index) => `${col} = ${'$' + (index + 1)}`).join(',');
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

        let [schema, table] = context.properties.table.split('.');
        if (!table) {
            table = schema;
            schema = 'public';
        }

        let query = `UPDATE ${schema}.${table} SET ${set} WHERE ${where}`;
        await context.log({ step: 'query', query, values });

        const res = await lib.query(context, query, values);
        return context.sendJson({ rowCount: res.rowCount }, 'out');
    },

    async stop(context) {

        await lib.disconnect(context);
    }
};
