'use strict';
const { Timestamp } = require('mongodb');
const { getOrCreateConnection, closeConnection } = require('./connections');

module.exports = {

    async getClient(context) {
        const connectionUri = context.auth?.connectionUri || context.connectionUri;

        const options = {};

        // Apply TLS settings based on source of call (auth.js or other)
        const tlsCAFileContent = context.auth?.tlsCAFileContent || context.tlsCAFileContent;
        const tlsAllowInvalidHostnames = context.auth?.tlsAllowInvalidHostnames || context.tlsAllowInvalidHostnames;
        const tlsAllowInvalidCertificates = context.auth?.tlsAllowInvalidCertificates || context.tlsAllowInvalidCertificates; // eslint-disable-line max-len

        if (tlsCAFileContent) {
            options.tls = true;
            options.tlsCAFileContent = tlsCAFileContent;
        }
        if (tlsAllowInvalidHostnames == 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (tlsAllowInvalidCertificates == 'true') {
            options.tlsAllowInvalidCertificates = true;
        }

        // Reuse or create new connection through connection pooling
        return getOrCreateConnection(connectionUri, options);
    },

    getCollection(client, dbName, collectionName) {
        const db = client.db(dbName);
        return db.collection(collectionName);
    },

    async getReplicaSetStatus(client) {
        const db = client.db('admin');
        try {
            await db.admin().command({ replSetGetStatus: 1 });
            return true;
        } catch (error) {
            return false;
        }
    },

    getChangeStream(operation, collection, { startAtOperationTime, resumeToken }) {
        const matchStage = {
            $match: { 'operationType': operation }
        };

        const options = {};
        if (resumeToken) {
            options.startAfter = { _data: resumeToken };
        } else if (startAtOperationTime) {
            options.startAtOperationTime = new Timestamp(1, startAtOperationTime);
        }

        return collection.watch([matchStage], options);
    },

    async ensureStore(context, name, storeId) {
        const stateStoreId = await context.stateGet('storeId');
        let returnStoreId = storeId || stateStoreId;

        if (!storeId) {
            try {
                const newStoreResponse = await context.callAppmixer({
                    endPoint: '/stores',
                    method: 'POST',
                    body: {
                        name
                    }
                });
                returnStoreId = newStoreResponse.storeId;
            } catch (err) {
                if (!err.message.includes('duplicate key error')) {
                    throw err;
                }
                const stores = await context.callAppmixer({
                    endPoint: '/stores',
                    method: 'GET'
                });
                const selectedStore = stores.find(store => store.name === name);
                returnStoreId = selectedStore.storeId;
            }
        }
        await context.stateSet('storeId', returnStoreId);
        return returnStoreId;
    },

    async setOperationalTimestamp(context) {
        const ts = Math.floor(new Date().getTime() / 1000);
        await context.stateSet('startAtOperationTime', ts);
    },

    async processDocuments({ lock, client, context, storeId, docIds }) {
        const db = client.db(context.auth.database);
        const collection = db.collection(context.properties.collection);
        const cursor = await collection.find();

        for await (const doc of cursor) {
            const jsonDoc = JSON.parse(JSON.stringify(doc));
            await context.store.set(storeId, jsonDoc['_id'], jsonDoc);
            docIds && docIds.push(jsonDoc['_id']);
            lock && lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 2);
        }
    },

    async closeClient(connectionUri) {
        await closeConnection(connectionUri);
    }
};
