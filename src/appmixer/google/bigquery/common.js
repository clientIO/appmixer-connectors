const Promise = require('bluebird');
const commons = require('../google-commons');
const EventEmitter = require('events');


module.exports.getInterval = function(context) {

    return parseInt(context.config.queryPollingInterval, 10) || 5 * 1000;
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
