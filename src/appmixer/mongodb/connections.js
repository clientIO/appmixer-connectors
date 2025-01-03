'use strict';
const { MongoClient } = require('mongodb');
const fs = require('fs');
const tmp = require('tmp');

// Ensure shared connections persist across different flows and nodes
process.MONGO_CONNECTOR_OPEN_CONNECTIONS = process.MONGO_CONNECTOR_OPEN_CONNECTIONS || {};

module.exports = {
    async getOrCreateConnection(connectionUri, options = {}) {
        let tmpFile;
        let tmpDir;

        // Handle TLS certificate if provided
        if (options.tls && options.tlsCAFileContent) {
            tmpDir = tmp.dirSync();
            tmpFile = tmpDir.name + '/key.crt';
            fs.writeFileSync(tmpFile, options.tlsCAFileContent);
            options.tlsCAFile = tmpFile;
        }

        // Reuse existing connection if available
        if (process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri]) {
            return process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri];
        }

        const client = new MongoClient(connectionUri, options);
        try {
            await client.connect();
            process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri] = client;
            return client;
        } catch (err) {
            console.error(`Failed to connect to MongoDB: ${err.message}`);
            throw err;
        } finally {
            if (tmpDir) {
                fs.rm(tmpDir.name, { recursive: true }, () => {});
            }
        }
    },

    closeConnection(connectionUri) {
        const client = process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri];
        if (client) {
            client.close();
            delete process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri];
        }
    },

    getConnection(connectionUri) {
        return process.MONGO_CONNECTOR_OPEN_CONNECTIONS[connectionUri] || null;
    },

    listConnections() {
        return process.MONGO_CONNECTOR_OPEN_CONNECTIONS;
    }
};
