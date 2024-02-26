'use strict';
const mysql = require('mysql');
const { stringify } = require('csv-stringify');
const { runQuery } = require('../../common');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { query, outputType } = context.messages.in.content;

        const opt = {
            user: context.auth.dbUser,
            host: context.auth.dbHost,
            database: context.auth.database,
            password: context.auth.dbPassword
        };
        if (context.auth.dbPort) {
            opt.port = context.auth.dbPort;
        }

        let conn;
        try {
            conn = mysql.createConnection(opt);

            await new Promise((resolve, reject) => {
                conn.connect(err => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            if (outputType === 'file') {
                const queryStream = conn.query(query).stream({ highWaterMark: 10 });
                const stringifier = stringify({ header: true });
                const savedFile = await context.saveFileStream('result.csv', queryStream.pipe(stringifier));
                await context.sendJson({ fileId: savedFile.fileId }, 'out');
            } else {
                let index = 0;
                const rows = [];
                const stream = await runQuery(conn, query, []);

                await new Promise((resolve, reject) => {
                    stream.on('data', async (row) => {
                        if (outputType === 'row') {
                            await context.sendJson({row, index: index++}, 'out');
                        } else if (outputType === 'rows') {
                            rows.push(row);
                        } else {
                            throw new Error('Unsupported outputType ' + outputType);
                        }
                    });

                    stream.on('error', (err) => reject(err));

                    stream.on('end', async () => {
                        resolve();
                    });
                });

                if (outputType === 'rows') {
                    await context.sendJson({ rows }, 'out');
                }
            }
        } finally {
            if (conn) {
                conn.end();
            }
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'row') {
            return context.sendJson([{ label: 'Row', value: 'row' }, { label: 'Index', value: 'index' }], 'out');
        } else if (outputType === 'rows') {
            return context.sendJson([{ label: 'Rows', value: 'rows' }], 'out');
        } else {        // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
