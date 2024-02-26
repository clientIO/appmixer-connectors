'use strict';
const { SnowflakeDB } = require('../../common');
const { stringify } = require('csv-stringify');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }
        const { query, outputType } = context.messages.in.content;

        const snowflake = new SnowflakeDB();

        if (outputType === 'file') {

            const queryStream = await snowflake.getRows(context.auth, {
                sqlText: query
            });
            const stringifier = stringify({ header: true });
            const savedFile = await context.saveFileStream('result.csv', queryStream.pipe(stringifier));
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        } else {
            let index = 0;
            const rows = [];
            let collectedRows = await snowflake.collectRows(context.auth, {
                sqlText: query
            });
            for (const row of collectedRows) {
                if (outputType === 'row') {
                    await context.sendJson({ row, index: index++ }, 'out');
                } else if (outputType === 'rows') {
                    rows.push(row);
                } else {
                    throw new Error('Unsupported outputType ' + outputType);
                }
            }
            if (outputType === 'rows') {
                await context.sendJson({ rows }, 'out');
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
