'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const row = context.messages.row.content;
        const columns = Object.keys(row);
        const values = Object.values(row);
        const valuesMarkers = columns.map((col, index) => '$' + (index + 1));

        let [schema, table] = context.properties.table.split('.');
        if (!table) {
            table = schema;
            schema = 'public';
        }

        let query = `INSERT INTO ${schema}.${table}(${columns.join(',')}) VALUES(${valuesMarkers.join(',')}) RETURNING *`;
        await context.log({ step: 'query', query });

        const res = await lib.query(context, query, values);
        return context.sendJson(res.rows[0], 'newRow');
    },

    async stop(context) {

        await lib.disconnect(context);
    }
};


