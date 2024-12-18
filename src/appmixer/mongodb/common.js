'use strict';
const { MongoClient, Timestamp } = require('mongodb');
const fs = require('fs');
const tmp = require('tmp');

// Global MongoDB Connection Management
let MONGODB_CONNECTOR_OPEN_CONNECTIONS;
if (process.MONGODB_CONNECTOR_OPEN_CONNECTIONS) {
    MONGODB_CONNECTOR_OPEN_CONNECTIONS = process.MONGODB_CONNECTOR_OPEN_CONNECTIONS;
} else {
    process.MONGODB_CONNECTOR_OPEN_CONNECTIONS = MONGODB_CONNECTOR_OPEN_CONNECTIONS = {};
}

// Helper to clean up temporary folders
async function removeTmpFolder(tmpDir) {
    await new Promise((resolve, reject) => {
        fs.rm(tmpDir.name, { recursive: true }, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

module.exports = {
    async getClient(context) {
        const { connectionUri, tlsCAFileContent, tlsAllowInvalidHostnames, tlsAllowInvalidCertificates } = context;

        // Check if the connection already exists
        if (MONGODB_CONNECTOR_OPEN_CONNECTIONS[connectionUri]) {
            return MONGODB_CONNECTOR_OPEN_CONNECTIONS[connectionUri];
        }

        let tmpFile;
        let tmpDir;
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true
        };

        // Handle inline TLS CA file content
        if (tlsCAFileContent) {
            tmpDir = tmp.dirSync(); // Create temporary directory
            tmpFile = tmpDir.name + '/key.crt'; // Define file path
            fs.writeFileSync(tmpFile, tlsCAFileContent); // Write CA content to file
            options.tls = true;
            options.tlsCAFile = tmpFile;
        }

        // Handle additional TLS options
        if (tlsAllowInvalidHostnames === 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (tlsAllowInvalidCertificates === 'true') {
            options.tlsAllowInvalidCertificates = true;
        }

        const client = new MongoClient(connectionUri, options);

        try {
            await client.connect();
            MONGODB_CONNECTOR_OPEN_CONNECTIONS[connectionUri] = client; // Save client for reuse
            return client;
        } catch (error) {
            if (tlsCAFileContent) {
                await removeTmpFolder(tmpDir); // Clean up temp files if connection fails
            }
            throw error;
        }
    },

    async cleanupConnections(context) {
        for (const [uri, client] of Object.entries(MONGODB_CONNECTOR_OPEN_CONNECTIONS)) {
            if (!await context.service.stateGet(uri)) {
                await client.close();
                delete MONGODB_CONNECTOR_OPEN_CONNECTIONS[uri];
                await context.log('info', `[MongoDB] Connection ${uri} closed.`);
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
        const matchStage = { $match: { operationType: operation } };

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
    }
};
