'use strict';

const mssql = require('mssql');
const { stringify } = require('csv-stringify');
const { runQuery } = require('../../common');

module.exports = {
    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        try {
            const queryResponse = await runQuery({ context: context.auth, query, stream: outputType === 'file' });
            await this.handleQueryResponse(context, queryResponse, outputType);
        } catch (error) {
            throw new context.CancelError('Error executing query: ' + error);
        } finally {
            mssql.close();
        }
    },

    async handleQueryResponse(context, queryResponse, outputType) {

        if (!queryResponse) {
            throw new Error('No response from query execution'); // Added null check for queryResponse
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

        let rowsAffected = 0;
        const stringifier = stringify({ header: true });

        queryResponse.on('rowsaffected', (count) => {

            rowsAffected = count;
        });
        const savedFile = await context.saveFileStream(`mssql-query-result-${Date.now()}`, queryResponse.pipe(stringifier));

        await context.sendJson({ fileId: savedFile.fileId }, 'out');
        await context.sendJson(this.getMetadata(context, rowsAffected), 'info');
    },

    async handleRowOutputs(context, queryResponse, outputType) {
        const rows = [];
        const rowsAffected = queryResponse.rowsAffected?.[0] || 0;

        if (queryResponse.recordset) {
            // Handle SELECT query results
            for (const row of queryResponse.recordset) {
                if (outputType === 'object') {
                    await context.sendJson({ result: row }, 'out');
                } else {
                    rows.push(row);
                }
            }
            if (outputType === 'array') {
                await context.sendJson({ result: rows }, 'out');
            }
        } else {
            // Handle non-SELECT queries (e.g., INSERT, UPDATE, DELETE)
            if (outputType === 'object') {
                await context.sendJson({ result: { rowsAffected } }, 'out');
            } else if (outputType === 'array') {
                await context.sendJson({ result: [{ rowsAffected }] }, 'out');
            }
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
