'use strict';

const mssql = require('mssql');
const { runQuery } = require('../../common');

module.exports = {

    async receive(context) {

        const query = 'SELECT name FROM sys.tables WHERE is_ms_shipped = 0;';

        try {
            const tables = await runQuery({ context: context.auth, query, stream: false });
            await context.sendJson({ tables }, 'tables');
        } finally {
            mssql.close();
        }
    }
};

