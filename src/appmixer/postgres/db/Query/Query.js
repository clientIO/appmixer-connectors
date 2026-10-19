'use strict';

const crypto = require('crypto');
const lib = require('../../lib');
const QueryStream = require('pg-query-stream');

module.exports = {

    async receive(context) {

        // ─── ASYNC RESULT DELIVERY ─────────────────────────────────────────────
        // Called by jobs.js via triggerComponent — data may arrive in webhook or in port.
        // Try multiple possible locations for the async callback data.
        const webhookData = context.messages.webhook?.content?.data
            || context.messages.webhook?.content
            || null;
        if (webhookData && webhookData.asyncJobId) {
            return this.deliverAsyncResult(context, webhookData);
        }

        // Also check if triggerComponent delivered via the 'in' port
        const inData = context.messages.in?.content;
        if (inData && inData.asyncJobId) {
            return this.deliverAsyncResult(context, inData);
        }

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const { query, outputType, asyncMode } = context.messages.in.content;

        // ─── ASYNC MODE: START LONG-RUNNING QUERY ─────────────────────────────
        if (asyncMode) {
            return this.startAsyncQuery(context, query, outputType);
        }

        // ─── SYNC MODE: standard execution (unchanged) ────────────────────────
        await context.log({ step: 'query', query });

        if (outputType === 'file') {
            const savedFile = await lib.streamQueryToFile(context, 'result.csv', query);
            if (!savedFile.length) {
                await context.sendJson({ query, message: 'No data returned for the query.' }, 'emptyResult');
                return;
            }
            return context.sendJson({ fileId: savedFile.fileId }, 'out');
        }

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
                        reject(new Error('Unsupported outputType ' + outputType));
                    }
                });
                stream.on('error', reject);
                stream.on('end', resolve);
            });
        } finally {
            client.release();
        }

        if (!hasData) {
            return context.sendJson({ query, message: 'No data returned for the query.' }, 'emptyResult');
        }

        if (outputType === 'rows') {
            return context.sendJson({ rows }, 'out');
        }
    },

    /**
     * Registers an async (dblink-based) query job and returns immediately.
     * The query itself is started by jobs.js (syncPendingJobs) in the plugin
     * process — components run in engine worker processes that share no memory
     * with the plugin, so a dblink session opened here could never be polled
     * by the plugin's poll job. Results are delivered later via
     * deliverAsyncResult() triggered by jobs.js.
     */
    async startAsyncQuery(context, query, outputType) {

        // The dblink result wrapper (row_to_json over a subquery) only works for
        // statements that return rows, and a recovered job may be re-executed —
        // so async mode is restricted to single, read-only SELECT/WITH queries.
        const trimmedQuery = query.trim().replace(/;\s*$/, '');
        if (trimmedQuery.includes(';')) {
            throw new context.CancelError('Async Mode supports a single SQL statement only.');
        }
        if (!/^(select|with)\b/i.test(trimmedQuery)) {
            throw new context.CancelError('Async Mode supports read-only SELECT (or WITH ... SELECT) queries only.');
        }

        const jobId = crypto.randomBytes(16).toString('hex');

        await context.log({ step: 'async_query_start', jobId, query });

        const jobData = {
            jobId,
            status: 'running',
            flowId: context.flowId,
            componentId: context.componentId,
            auth: context.auth,
            query,
            outputType,
            createdAt: new Date().toISOString()
        };

        // Register the job via service-level state so jobs.js can persist it to MongoDB
        // and start the dblink query in the plugin process (the only process that can
        // poll it). Using stateAddToSet so multiple concurrent async queries don't
        // overwrite each other.
        await context.service.stateAddToSet('pendingAsyncJobs', jobData);

        await context.log({ step: 'async_query_registered', jobId });

        // Return without sending to output — jobs.js will deliver results asynchronously
    },

    /**
     * Called when jobs.js has determined the query is complete (or errored).
     * Receives result rows directly in the triggerComponent payload.
     */
    async deliverAsyncResult(
        context,
        { asyncJobId: jobId, outputType, query, asyncRows, asyncError, asyncFileId, asyncRowCount }
    ) {

        if (asyncError) {
            throw new Error(`Async query failed: ${asyncError}`);
        }

        if (outputType === 'file') {
            // jobs.js streamed the result into file storage — only the fileId travels
            // in the message, so arbitrarily large results are safe.
            await context.log({ step: 'async_query_deliver', jobId, fileId: asyncFileId, rowCount: asyncRowCount });
            if (!asyncFileId) {
                return context.sendJson({ query, message: 'No data returned for the query.' }, 'emptyResult');
            }
            return context.sendJson({ fileId: asyncFileId }, 'out');
        }

        const rows = asyncRows || [];

        await context.log({ step: 'async_query_deliver', jobId, rowCount: rows.length });

        if (!rows.length) {
            return context.sendJson({ query, message: 'No data returned for the query.' }, 'emptyResult');
        }

        if (outputType === 'row') {
            for (let i = 0; i < rows.length; i++) {
                await context.sendJson({ row: rows[i], index: i }, 'out');
            }
        } else {
            await context.sendJson({ rows }, 'out');
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
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
