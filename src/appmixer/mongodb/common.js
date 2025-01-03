'use strict';
const { Timestamp } = require('mongodb');
const { getOrCreateConnection } = require('./connections');

// Retrieves the MongoDB client for the given context (authorization info)
async function getClient(context) {
    const connectionUri = context.auth.connectionUri;
    const options = {
        tls: !!context.auth.tlsCAFileContent
    };

    if (context.auth.tlsAllowInvalidHostnames === 'true') {
        options.tlsAllowInvalidHostnames = true;
    }
    if (context.auth.tlsAllowInvalidCertificates === 'true') {
        options.tlsAllowInvalidCertificates = true;
    }

    return getOrCreateConnection(connectionUri, options);
}

// Retrieves a collection from the MongoDB client based on the database and collection name
function getCollection(client, database, collectionName) {
    return client.db(database).collection(collectionName);
}

// Opens a change stream to watch for operations on a collection
function getChangeStream(operationType, collection, options = {}) {
    const changeStream = collection.watch([], {
        fullDocument: 'updateLookup',
        ...options
    });

    changeStream.on('change', (change) => {
        if (change.operationType === operationType) {
            changeStream.emit('filteredChange', change);
        }
    });

    return changeStream;
}

// Retrieves replica set status to check if the MongoDB instance is part of a replica set
async function getReplicaSetStatus(client) {
    const adminDb = client.db('admin');
    const result = await adminDb.command({ replSetGetStatus: 1 });
    return result.ok === 1;
}

// Ensures webhook store is created and returns its ID
async function ensureStore(context, storeName) {
    const store = await context.store.get(storeName);
    if (store) {
        return store.id;
    }
    const newStore = await context.store.create({ name: storeName });
    return newStore.id;
}

// Processes documents by iterating and sending them to the Appmixer flow
async function processDocuments({ lock, client, context, storeId }) {
    const collection = getCollection(client, context.auth.database, context.properties.collection);
    const cursor = collection.find({}, {
        sort: { _id: -1 }
    }).limit(10);

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        await context.sendJson({ document: doc }, 'out');
    }
    await context.store.setState(storeId, 'lastRun', Date.now());
}

// Saves the resume token to state to track the last processed change stream event
async function setOperationalTimestamp(context, clusterTime) {
    const timestamp = clusterTime instanceof Timestamp ? clusterTime : Timestamp.fromString(clusterTime);
    await context.stateSet('startAtOperationTime', timestamp);
}

// Closes the MongoDB connection and removes it from the active pool
async function closeClient(connectionUri) {
    const { closeConnection } = require('./connections');
    await closeConnection(connectionUri);
}

// Export all utility functions
module.exports = {
    getClient,
    getCollection,
    getChangeStream,
    getReplicaSetStatus,
    ensureStore,
    processDocuments,
    setOperationalTimestamp,
    closeClient
};
