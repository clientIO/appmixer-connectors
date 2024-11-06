'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const query = 'SELECT * FROM pg_catalog.pg_tables WHERE schemaname != \'pg_catalog\' AND schemaname != \'information_schema\'';

        await context.log({ step: 'query', query });

        let res;
        try {
            res = await lib.query(context, query);
        } finally {
            await lib.disconnect(context);
        }
        return context.sendJson(res.rows, 'tables');
    },

    toSelectArray(tables) {

        let transformed = [];

        if (Array.isArray(tables)) {
            tables.forEach(table => {
                transformed.push({
                    label: table['schemaname'] + '.' + table['tablename'],
                    value: table['schemaname'] + '.' + table['tablename']
                });
            });
        }

        return transformed;
    }
};
