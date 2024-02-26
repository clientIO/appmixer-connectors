'use strict';

const { Transform } = require('stream');
const { stringify } = require('csv-stringify');
const { runQuery } = require('../common'); // Ensure this is compatible with pg

module.exports = {
    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        try {
            const queryResponse = await runQuery({ context: context.auth, query, stream: outputType === 'file' });
            await this.handleQueryResponse(context, queryResponse, outputType);
        } catch (error) {
            throw new context.CancelError('Error executing query: ' + error);
        }
    },

    async handleQueryResponse(context, queryResponse, outputType) {

        if (!queryResponse) {
            throw new Error('No response from query execution');
        }
        switch (outputType) {
            case 'file':
                await this.handleFileOutput(context, queryResponse);
                break;
            case 'object':
            case 'array':
                await this.handleRowOutputs(context, queryResponse, outputType);
                break;
            default:
                throw new Error(`Unsupported output type: ${outputType}`);
        }
    },

    async handleFileOutput(context, queryResponse) {

        let rowCount = 0;

        // Custom transform stream to count rows
        const countRows = new Transform({
            objectMode: true,
            transform(chunk, encoding, callback) {
                rowCount++;
                this.push(chunk); // Pass the chunk along
                callback();
            }
        });

        // Handling for streaming response
        const stringifier = stringify({ header: true });
        const savedFile = await context.saveFileStream(`redshift-query-result-${Date.now()}`, queryResponse.pipe(countRows).pipe(stringifier));

        await context.sendJson({ fileId: savedFile.fileId }, 'out');
        await context.sendJson(this.getMetadata(context, rowCount), 'info');
    },

    async handleRowOutputs(context, queryResponse, outputType) {

        const rows = queryResponse.rows;
        const rowsAffected = queryResponse.rowCount || rows.length;
        if (outputType === 'array') {
            await context.sendJson({ result: rows }, 'out');
        } else {

            // Handle each row individually for 'object' type
            rows.forEach(async row => {
                await context.sendJson({ result: row }, 'out');
            });
        }
        await context.sendJson(this.getMetadata(context, rowsAffected), 'info');
    },

    getQueryType(query) {

        const firstWord = query.trim().split(/\s+/)[0].toUpperCase();
        return ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(firstWord) ? firstWord : 'OTHER';
    },

    getMetadata(context, rowsAffected) {

        const queryType = this.getQueryType(context.messages.in.content.query);
        const s = rowsAffected === 1 ? '' : 's';
        const messages = {
            'SELECT': { message: `Retrieved ${rowsAffected} row${s}.` , rowsAffected: 0 },
            'INSERT': { message: `Inserted ${rowsAffected} row${s}.`, rowsAffected },
            'UPDATE': { message: `Updated ${rowsAffected} row${s}.`, rowsAffected },
            'DELETE': { message: `Deleted ${rowsAffected} row${s}.`, rowsAffected },
            'OTHER': { message: 'Query executed successfully.' , rowsAffected }
        };
        return messages[queryType] || messages.OTHER;
    }
};
