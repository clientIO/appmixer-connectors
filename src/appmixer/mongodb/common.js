'use strict';
const { MongoClient, Timestamp } = require('mongodb');
const fs = require('fs');
const tmp = require('tmp');

module.exports = {

    async getClient(context) {

        let tmpFile;
        let tmpDir;
        const options = {
            tls: !!context.tlsCAFileContent
        };
        if (context.tlsCAFileContent) {
            tmpDir = tmp.dirSync();
            tmpFile = tmpDir.name + '/key.crt';
            // Write the contents to the temporary file
            fs.writeFileSync(tmpFile, context.tlsCAFileContent);
            options.tlsCAFile = tmpFile;
        }
        if (context.tlsAllowInvalidHostnames == 'true') {
            options.tlsAllowInvalidHostnames = true;
        }
        if (context.tlsAllowInvalidCertificates == 'true') {
            options.tlsAllowInvalidCertificates = true;
        }
        const client = new MongoClient(context.connectionUri, context.tlsCAFileContent && options);
        try {
            await client.connect();
        } catch (error) {
            if (context.tlsCAFileContent) {
                // Removing the temporary file and directory if the connection fails
                await removeTmpFolder(tmpDir);
            }
            throw error;
        }

        if (context.tlsCAFileContent) {
            await removeTmpFolder(tmpDir);
        }
        return client;
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

async function removeTmpFolder(tmpDir) {

    await new Promise((resolve, reject) => {

        fs.rm(tmpDir.name, { recursive: true }, (err) => {

            if (err) {
                reject(err);
            }
            resolve();
        });
    });
}
