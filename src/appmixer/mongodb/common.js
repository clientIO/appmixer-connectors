'use strict';
const { Timestamp } = require('mongodb');
const { getOrCreateConnection, closeConnection } = require('./connections');

module.exports = {

    async getClient(context) {
        const connectionUri = context.auth.connectionUri;
        const options = {
            tls: !!context.auth.tlsCAFileContent
        };

        if (context.auth.tlsAllowInvalidHostnames == 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (context.auth.tlsAllowInvalidCertificates == 'true') {
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
                // Ignore error if the store already exists
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

    async setOperationalTimestamp(context, clusterTime) {
        const timestamp = clusterTime instanceof Timestamp ? clusterTime : Timestamp.fromString(clusterTime);
        await context.stateSet('startAtOperationTime', timestamp);
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
