'use strict';
const { MongoClient, Timestamp } = require('mongodb');
const fs = require('fs');
const tmp = require('tmp');

let MONGO_CONNECTOR_OPEN_CONNECTIONS;
if (process.MONGO_CONNECTOR_OPEN_CONNECTIONS) {
    MONGO_CONNECTOR_OPEN_CONNECTIONS = process.MONGO_CONNECTOR_OPEN_CONNECTIONS;
} else {
    process.MONGO_CONNECTOR_OPEN_CONNECTIONS = MONGO_CONNECTOR_OPEN_CONNECTIONS = {};
}

module.exports = {

    async getClient(context, flowId, componentId, auth) {
        let tmpFile;
        let tmpDir;
        const connectionUri = context.auth.connectionUri;
        let connectionId = await context.service.stateGet('connectionId');

        if (connectionId && MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionId]) {
            return MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionId];
        }

        // If not found, generate a new connectionId
        if (!connectionId) {
            connectionId = `client:${flowId}:${componentId}:${Math.random().toString(36).substring(7)}`;
            await context.service.stateSet('connectionId', connectionId);
        }

        const options = {};

        // Apply TLS settings based on auth or direct context
        const tlsCAFileContent = context.auth.tlsCAFileContent;
        const tlsAllowInvalidHostnames = context.auth.tlsAllowInvalidHostnames;
        const tlsAllowInvalidCertificates = context.auth.tlsAllowInvalidCertificates;

        if (tlsCAFileContent) {
            options.tls = true;
            options.tlsCAFileContent = tlsCAFileContent;
        }
        if (tlsAllowInvalidHostnames === 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (tlsAllowInvalidCertificates === 'true') {
            options.tlsAllowInvalidCertificates = true;
        }

        // Handle TLS certificate files
        if (options.tls && options.tlsCAFileContent) {
            try {
                tmpDir = tmp.dirSync();
                tmpFile = `${tmpDir.name}/key.crt`;
                fs.writeFileSync(tmpFile, options.tlsCAFileContent);
                options.tlsCAFile = tmpFile;
            } catch (err) {
                throw new Error(`Failed to create TLS certificate: ${err.message}`);
            }
        }

        // Create a new MongoDB client
        const client = new MongoClient(connectionUri, options);

        try {
            // Connect to MongoDB
            await client.connect();
            MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionId] = client;

            // Store connection in state for tracking
            await context.service.stateSet(connectionId, {
                flowId,
                componentId,
                auth
            });


            return client;
        } catch (err) {
            await context.service.stateUnset(connectionId);
            throw new Error(`Failed to connect to MongoDB: ${err.message}`);
        } finally {
            if (tmpDir) {
                fs.rm(tmpDir.name, { recursive: true }, () => {});
            }
        }
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
                    body: { name }
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
        const ts = Math.floor(Date.now() / 1000);
        await context.stateSet('startAtOperationTime', ts);
    },

    async processDocuments({ lock, client, context, storeId, docIds }) {
        const db = client.db(context.auth.database);
        const collection = db.collection(context.properties.collection);
        const cursor = await collection.find();

        for await (const doc of cursor) {
            const jsonDoc = JSON.parse(JSON.stringify(doc));
            await context.store.set(storeId, jsonDoc['_id'], jsonDoc);
            if (docIds) docIds.push(jsonDoc['_id']);
            if (lock) lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 2);
        }
    },

    async closeClient(context, connectionId) {
        await context.service.stateUnset(connectionId);
        const client = MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionId];
        if (client) {
            await client.close();
            delete MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionId];
        }
    },
    async getClientForAuth(context) {
        let tmpFile;
        let tmpDir;
        const connectionUri = context.connectionUri;
        const options = {};

        const tlsCAFileContent = context.tlsCAFileContent;
        const tlsAllowInvalidHostnames = context.tlsAllowInvalidHostnames;
        const tlsAllowInvalidCertificates = context.tlsAllowInvalidCertificates;

        if (tlsCAFileContent) {
            options.tls = true;
            options.tlsCAFileContent = tlsCAFileContent;
        }
        if (tlsAllowInvalidHostnames === 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (tlsAllowInvalidCertificates === 'true') {
            options.tlsAllowInvalidCertificates = true;
        }

        if (options.tls && options.tlsCAFileContent) {
            try {
                tmpDir = tmp.dirSync();
                tmpFile = `${tmpDir.name}/key.crt`;
                fs.writeFileSync(tmpFile, options.tlsCAFileContent);
                options.tlsCAFile = tmpFile;
            } catch (err) {
                throw err;
            }
        }

        const client = new MongoClient(connectionUri, options);

        try {
            await client.connect();
            return client;  // Temporary client returned directly for auth
        } catch (err) {
            throw err;
        } finally {
            if (tmpDir) {
                fs.rm(tmpDir.name, { recursive: true }, () => {});
            }
        }
    },
    listConnections() {
        return MONGO_CONNECTOR_OPEN_CONNECTIONS;
    }

};
