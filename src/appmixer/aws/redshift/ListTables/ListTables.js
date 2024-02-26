'use strict';

const { runQuery } = require('../common');

module.exports = {
    async receive(context) {

        const query =
          // eslint-disable-next-line max-len
          "SELECT tablename, schemaname FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'";

        try {
            let res = await runQuery({ context: context.auth, query });
            await context.sendJson(res.rows, 'tables');
        } catch (error) {
            throw new context.CancelError('Error fetching tables: ' + error);
        }
    },

    toSelectArray(tables) {

        let transformed = [];

        if (Array.isArray(tables)) {
            tables.forEach((table) => {
                transformed.push({
                    label: table['tablename'],
                    value: table['tablename']
                });
            });
        }

        return transformed;
    }
};
