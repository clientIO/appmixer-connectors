'use strict';

const mysql = require('mysql');
const EventEmitter = require('events');

class StreamProcessor {

    constructor(context) {

        this.eventEmitter = new EventEmitter();
        this.context = context;
    }

    processStream(conn, queryStream, processCb, concurrency = 1) {

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
                .on('result', async (row) => {
                    // Pausing the connection is useful if your processing involves I/O

                    const promise = processCallback(row);
                    promises.push(promise);
                    if (promises.length >= concurrency) {
                        conn.pause();
                        this.eventEmitter.emit('batchProcessed');
                        await Promise.all(promises);
                        promises = [];
                        conn.resume();
                    }
                })
                .on('end', async () => {
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

    let conn;

    const opt = {
        user: context.auth.dbUser,
        host: context.auth.dbHost,
        database: context.auth.database,
        password: context.auth.dbPassword,
        dateStrings: true,
        supportBigNumbers: true
    };
    if (context.auth.dbPort) {
        opt.port = context.auth.dbPort;
    }

    conn = mysql.createConnection(opt);

    await new Promise((resolve, reject) => {
        conn.connect(err => {
            if (err) return reject(err);
            resolve();
        });
    });

    return conn;
}

/**
 * Validates that a SQL query starts with SELECT or WITH (for CTEs).
 * Multiple statements are blocked by MySQL driver default (multipleStatements: false).
 * @param {string} query - The SQL query to validate
 * @throws {Error} If the query doesn't start with SELECT or WITH
 */
function validateQuery(query) {
    if (!/^\s*(select|with)\s/i.test(query)) {
        throw new Error('Only SELECT or WITH queries are allowed');
    }
}

async function runQuery(conn, query, params) {

    return await conn.query(query, params).stream({ highWaterMark: 10 });
}

/**
 * Read-only helper shared by trigger test() methods (Flow Test Mode).
 *
 * Runs the SAME validated SELECT path tick()/start() use (createConnection + validateQuery +
 * runQuery + StreamProcessor), but collects rows into a local array instead of writing them to
 * the data store. It does NOT touch component/flow/service state, register webhooks or mutate
 * anything remote. It returns the "newest" row from the result set, picked by the configured
 * idField (highest numeric id, falling back to string comparison), so the emitted example
 * matches what the trigger would eventually deliver via receive().
 *
 * @param {Object} context - The component context (auth + properties available).
 * @param {string} query - The user-supplied SELECT query.
 * @param {Array} params - Query parameters (e.g. [0] to fetch all rows since epoch).
 * @param {string} idField - The unique field used to order/identify rows.
 * @returns {Promise<Object|null>} The newest row, or null if the result set is empty.
 */
async function fetchLatestRow(context, query, params, idField) {

    let conn;
    let latest = null;

    const isNewer = (candidate, current) => {
        if (current === null) return true;
        const a = candidate[idField];
        const b = current[idField];
        const numA = Number(a);
        const numB = Number(b);
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
            return numA > numB;
        }
        return String(a) > String(b);
    };

    try {
        validateQuery(query);
        conn = await createConnection(context);
        const stream = await runQuery(conn, query, params);
        const concurrency = parseInt(context.config.concurrency, 10) || 100;

        const streamProcessor = new StreamProcessor(context);
        await streamProcessor.processStream(conn, stream, async (row) => {
            if (isNewer(row, latest)) {
                latest = row;
            }
        }, concurrency);
    } finally {
        if (conn) {
            conn.end();
        }
    }

    return latest;
}

module.exports = {

    StreamProcessor,

    createQueryProcessor(context, storeId, query, params, lock) {

        return async (callback) => {

            let conn;
            try {
                validateQuery(query);
                conn = await createConnection(context);
                const stream = await runQuery(conn, query, params);
                const concurrency = parseInt(context.config.concurrency, 10) || 100;

                const streamProcessor = new StreamProcessor(context);
                streamProcessor.onBatchProcessed(() => {
                    lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 2);
                });

                await streamProcessor.processStream(conn, stream, callback, concurrency);
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
    validateQuery,
    fetchLatestRow
};
