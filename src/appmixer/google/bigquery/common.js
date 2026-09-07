const Promise = require('bluebird');
const EventEmitter = require('events');
const { BigQuery } = require('@google-cloud/bigquery');
const googleCommons = require('../google-commons');

module.exports.getInterval = function(context) {

    return parseInt(context.config.queryPollingInterval, 10) || 5 * 1000;
};

// Read-only fetch of a single example row for Flow Test Mode. Runs the SAME user query the
// trigger polls with (the `?` placeholder, if any, is bound to 0 so all rows are eligible)
// using the SAME BigQuery client/auth as tick(), then returns the first row collected from the
// result stream. No data store, no webhook, no state writes. Returns null when the query is
// empty so test() can throw and fall through to the engine's fallback chain.
module.exports.fetchLatestExampleRow = function(context) {

    const { query, projectId } = context.properties;

    const client = new BigQuery({
        authClient: googleCommons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (err, row) => {
            if (settled) return;
            settled = true;
            return err ? reject(err) : resolve(row);
        };

        client.createQueryJob({ query, params: [0] }).then(([job]) => {
            const stream = job.getQueryResultsStream({
                wrapIntegers: {
                    integerTypeCastFunction: value => {
                        return parseInt(value) > Number.MAX_SAFE_INTEGER ? value : parseInt(value);
                    }
                }
            });
            stream.on('data', row => {
                // The polling path stores each row under idField; the webhook then emits the
                // stored row value. Emitting the first row collected here yields the same shape.
                finish(null, row);
                stream.destroy();
            });
            stream.on('error', err => finish(err));
            stream.on('end', () => finish(null, null));
        }).catch(err => finish(err));
    });
};

module.exports.StreamProcessor = class {

    constructor() {
        this.eventEmitter = new EventEmitter();
    }

    processStream(stream, context, storeId, idField, processFn) {

        let promises = [];
        const concurrency = parseInt(context.config.concurrency, 10) || 100;
        return new Promise((resolve, reject) => {
            stream.on('data', async row => {
                try {

                    const rowId = row[idField] + '';
                    const promise = processFn(storeId, rowId, row);
                    promises.push(promise);
                    if (promises.length >= concurrency) {
                        stream.pause();
                        await Promise.all(promises);
                        this.eventEmitter.emit('batchProcessed');
                        promises = [];
                        stream.resume();
                    }

                    //stream.pause();
                    //const rowId = row[idField] + '';
                    //await processFn(storeId, rowId, row);
                    //stream.resume();
                } catch (err) {
                    reject(err);
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });

            stream.on('end', async () => {
                await Promise.all(promises);
                resolve();
            });
        });
    }

    onBatchProcessed(callback) {

        this.eventEmitter.on('batchProcessed', callback);
    }
};

module.exports.processStream = function(stream, context, storeId, idField, processFn) {

    let promises = [];
    const concurrency = parseInt(context.config.concurrency, 10) || 100;
    return new Promise((resolve, reject) => {
        stream.on('data', async row => {
            try {

                const rowId = row[idField] + '';
                const promise = processFn(storeId, rowId, row);
                promises.push(promise);
                if (promises.length >= concurrency) {
                    stream.pause();
                    await Promise.all(promises);
                    promises = [];
                    stream.resume();
                }

                //stream.pause();
                //const rowId = row[idField] + '';
                //await processFn(storeId, rowId, row);
                //stream.resume();
            } catch (err) {
                reject(err);
            }
        });

        stream.on('error', (err) => {
            reject(err);
        });

        stream.on('end', async () => {
            await Promise.all(promises);
            resolve();
        });
    });
};

module.exports.ensureStore = async function(context, prefix) {

    let { storeId } = context.properties;
    const name = prefix + '-' + context.componentId;

    if (!storeId) {
        try {
            const newStoreResponse = await context.callAppmixer({
                endPoint: '/stores',
                method: 'POST',
                body: {
                    name
                }
            });
            storeId = newStoreResponse.storeId;
            await context.stateSet('storeId', storeId);
        }  catch (err) {
            // Ignore error if the store already exists
            if (!err.message.includes('duplicate key error')) {
                throw err;
            }
            const stores = await context.callAppmixer({
                endPoint: '/stores',
                method: 'GET'
            });
            const selectedStore = stores.find(store => store.name === name);
            storeId = selectedStore.storeId;
        }
    }
    return storeId;
};

module.exports.getStoreId = async function(context) {

    let { storeId } = context.properties;
    if (!storeId) {
        storeId = await context.stateGet('storeId');
    }
    return storeId;
};

module.exports.cleanupStorage = async function(context) {

    let { storeId, detectOnStop } = context.properties;

    const stateStoreId = await context.stateGet('storeId');
    if (!detectOnStop) {
        await context.stateClear();
    }

    if (!storeId && !detectOnStop) {
        storeId = stateStoreId;
        // No need to unregister our webhook from a store that we just deleted.
        return context.callAppmixer({
            endPoint: '/stores/' + storeId,
            method: 'DELETE'
        });
    }
    return context.store.unregisterWebhook(storeId || stateStoreId);
};
