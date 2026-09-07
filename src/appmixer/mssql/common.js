'use strict';

const mssql = require('mssql');
const EventEmitter = require('events');

class StreamProcessor {

    constructor(context) {

        this.eventEmitter = new EventEmitter();
        this.context = context;
    }

    processStream(queryStream, processCb, concurrency = 1) {

        let promises = [];
        return new Promise((resolve, reject) => {
            const processCallback = async (row) => {
                try {
                    return await processCb(row);
                } catch (err) {
                    // Just log the error. This prevents the promise chain from breaking if there
                    // was an error while processing a row.
                    this.context.log('error', err.message, err);
                }
            };

            queryStream
                .on('error', async (err) => {
                    // Handle error, an 'end' event will be emitted after this as well
                    reject(err);
                })
                .on('row', async (row) => {
                    const promise = processCallback(row);
                    promises.push(promise);
                    if (promises.length >= concurrency) {
                        queryStream.pause();
                        this.eventEmitter.emit('batchProcessed');
                        await Promise.all(promises);
                        promises = [];
                        queryStream.resume();
                    }
                })
                .on('done', async () => {
                    // all rows have been received
                    await Promise.all(promises);
                    resolve();
                })
                .resume();
        });
    }

    onBatchProcessed(callback) {

        this.eventEmitter.on('batchProcessed', callback);
    }
}

async function createConnection(context) {

    const opt = {
        user: context.dbUser,
        server: context.dbHost,
        database: context.database,
        password: context.dbPassword,
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        options: {
            encrypt: true,
            trustServerCertificate: true
        }
    };
    return await mssql.connect(opt);
}

/**
 * Validates that a SQL query starts with SELECT or WITH (for CTEs).
 * Multiple statements are blocked by MSSQL driver default.
 * @param {string} query - The SQL query to validate
 * @throws {Error} If the query doesn't start with SELECT or WITH
 */
function validateQuery(query) {
    if (!/^\s*(select|with)\s/i.test(query)) {
        throw new Error('Only SELECT or WITH queries are allowed');
    }
}

async function runQuery({ context, query, stream = false }) {

    const conn = await createConnection(context);
    const request = new mssql.Request(conn);
    request.stream = stream;

    if (stream) {
        request.query(query);
        return request;
    } else {
        return await request.query(query);
    }
}

/**
 * Read-only helper shared by triggers' test() methods (Flow Test Mode). Runs the SAME user
 * SELECT/WITH query the triggers poll (honoring context.properties.query and idField), but
 * wrapped to return only the single newest row, ordered by the configured idField DESC.
 * Mirrors the initial-run semantics by substituting the optional "?" timestamp placeholder
 * with 0 so that ALL rows match (and the newest is returned). Performs no mutations and writes
 * no state.
 *
 * @param {object} context - The component context (uses context.auth + context.properties).
 * @returns {Promise<object|null>} The newest row object, or null if the query returns no rows.
 */
async function fetchLatestRow(context) {

    const { query, idField } = context.properties;
    if (!query) {
        throw new Error('SQL Query is required.');
    }
    if (!idField) {
        throw new Error('ID field is required.');
    }

    validateQuery(query);

    // Same substitution start()/tick() apply on the initial run: replace the "?" timestamp
    // placeholder with 0 so the query matches all rows, then pick the newest.
    const baseQuery = query.replace(/\?/g, '0');

    // Wrap as a subquery so we can deterministically pick the newest row by the configured
    // idField without assuming anything about the user's ORDER BY / column list.
    // Escape closing brackets (T-SQL doubles `]` inside a bracket-quoted identifier) so an idField
    // containing `]` cannot break out of the quoting / inject SQL.
    const safeIdField = String(idField).replace(/]/g, ']]');
    const wrappedQuery = `SELECT TOP 1 * FROM (${baseQuery}) AS appmixer_test_sub ORDER BY [${safeIdField}] DESC`;

    const result = await runQuery({ context: context.auth, query: wrappedQuery });
    const recordset = (result && result.recordset) || [];
    return recordset[0] || null;
}

module.exports = {

    StreamProcessor,

    createQueryProcessor(context, storeId, query, params, lock) {

        return async (callback) => {

            let conn;
            try {

                validateQuery(query);
                const stream = await runQuery({ context: context.auth, query, stream: true });
                const concurrency = parseInt(context.config.concurrency, 10) || 100;

                const streamProcessor = new StreamProcessor(context);
                streamProcessor.onBatchProcessed(() => {
                    lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 2);
                });

                await streamProcessor.processStream(stream, callback, concurrency);
            } finally {
                if (conn) {
                    conn.end();
                }
            }
        };
    },

    async ensureStore(context, storeId, storeName) {

        const stateStoreId = await context.stateGet('storeId');
        let returnStoreId = storeId || stateStoreId;

        if (!storeId) {
            try {
                const newStoreResponse = await context.callAppmixer({
                    endPoint: '/stores',
                    method: 'POST',
                    body: {
                        name: storeName
                    }
                });
                returnStoreId = newStoreResponse.storeId;
            } catch (err) {
                // Ignore error if the store already exists
                if (!err.message.includes('duplicate key error')) {
                    throw err;
                }
                const stores = await context.callAppmixer({
                    endPoint: '/stores',
                    method: 'GET'
                });
                const selectedStore = stores.find(store => store.name === storeName);
                returnStoreId = selectedStore.storeId;
            }
        }

        await context.stateSet('storeId', returnStoreId);
        return returnStoreId;
    },

    runQuery,
    createConnection,
    validateQuery,
    fetchLatestRow
};
