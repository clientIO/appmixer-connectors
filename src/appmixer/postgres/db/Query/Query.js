'use strict';

const lib = require('../../lib');
const QueryStream = require('pg-query-stream');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { query, outputType } = context.messages.in.content;

        await context.log({ step: 'query', query });

        if (outputType === 'file') {
            const savedFile = await lib.streamQueryToFile(context, 'result.csv', query);
            if (!savedFile.length) {
                await context.sendJson({ query, messages: 'No data returned for the query.' }, 'emptyResult');
            }
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        } else {
            const queryStream = new QueryStream(query);
            const client = await lib.connect(context);
            const stream = client.query(queryStream);
            let hasData = false;

            let index = 0;
            const rows = [];

            try {
                await new Promise((resolve, reject) => {
                    stream.on('data', async (row) => {
                        hasData = true;
                        if (outputType === 'row') {
                            await context.sendJson({ row, index: index++ }, 'out');
                        } else if (outputType === 'rows') {
                            rows.push(row);
                        } else {
                            throw new Error('Unsupported outputType ' + outputType);
                        }
                    });

                    stream.on('error', (err) => reject(err));

                    stream.on('end', async () => {
                        if (!hasData) {
                            await context.sendJson(
                                {
                                    query,
                                    messages: 'No data returned for the query.'
                                },
                                'emptyResult'
                            );
                        }
                        resolve();
                    });
                });
            } finally {
                client.release();
            }

            if (outputType === 'rows') {
                await context.sendJson({ rows }, 'out');
            }
        }
    },

    async stop(context) {

        await lib.disconnect(context);
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'row') {
            return context.sendJson([{ label: 'Row', value: 'row' }, { label: 'Index', value: 'index' }], 'out');
        } else if (outputType === 'rows') {
            return context.sendJson([{ label: 'Rows', value: 'rows' }], 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
