'use strict';

const mysql = require('mysql');

module.exports = {

    async receive(context) {

        const query = `SHOW TABLES`;

        const opt = {
            user: context.auth.dbUser,
            host: context.auth.dbHost,
            database: context.auth.database,
            password: context.auth.dbPassword
        };
        if (context.auth.dbPort) {
            opt.port = context.auth.dbPort;
        }

        const conn = mysql.createConnection(opt);

        await new Promise((resolve, reject) => {
            conn.connect(err => {
                if (err) return reject(err);
                resolve();
            });
        });

        try {
            const tables = await new Promise((resolve, reject) => {
                conn.query(query, (err, results, fields) => {
                    if (err) return reject(err);
                    resolve((results || []).map(item => {
                        const key = Object.keys(item)[0];
                        return item[key];
                    }));
                });
            });
            await context.sendJson({ tables }, 'tables');
        } finally {
            conn.end();
        }
    }
};

