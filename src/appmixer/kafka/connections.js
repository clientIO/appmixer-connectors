'use strict';

const { Kafka, logLevel, CompressionTypes, CompressionCodecs } = require('kafkajs');
const tmp = require('tmp');
const RegexParser = require('regex-parser');
const SnappyCodec = require('kafkajs-snappy');
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

// Note that we cannot simply define with `const KAFKA_CONNECTOR_OPEN_CONNECTIONS = {}; `.
// This is because the Appmixer engine clears the "require" cache
// when loading individual component code. Therefore, different Kafka componnets will not share the same OPEN_CONNECTIONS object
// even on the same node! Therefore, we take advantage of the global `process` object to get the variable if it exists, or create it if it doesn't.
// [connectionId]: consumer/producer object
let KAFKA_CONNECTOR_OPEN_CONNECTIONS;
if (process.KAFKA_CONNECTOR_OPEN_CONNECTIONS) {
    KAFKA_CONNECTOR_OPEN_CONNECTIONS = process.KAFKA_CONNECTOR_OPEN_CONNECTIONS;
} else {
    process.KAFKA_CONNECTOR_OPEN_CONNECTIONS = KAFKA_CONNECTOR_OPEN_CONNECTIONS = {};
}

const initClient = async (context, auth, connectionId) => {

    let tmpDir;
    let tmpFile;
    const {
        clientId,
        brokers,
        ssl,
        saslMechanism,
        saslUsername,
        saslPassword,
        sslRejectUnauthorized,
        connectionTimeout = 10000
    } = auth;
    const config = {
        clientId,
        logLevel: context.config?.logLevel ? logLevel[context.config.logLevel.toUpperCase()] : logLevel.INFO,
        logCreator: (level) => {
            return ({ namespace, level, label, log }) => {
                if (context.log) {
                    let logString;
                    try {
                        if (typeof log === 'string') {
                            logString = log;
                        } else {
                            logString = JSON.stringify(log);
                        }
                    } catch (e) {
                        logString = Object.keys(log || {}).join(', ');
                    }
                    context.log('info', '[KAFKA] ' + [
                        'namespace: ' + namespace,
                        'level: ' + level,
                        'label: ' + label,
                        'gridInstanceId: ' + context.gridInstanceId,
                        'log: ' + logString
                    ].join('; '));
                }
            };
        },
        brokers: brokers.split(',').map(broker => broker.trim()),
        connectionTimeout: context.config?.connectionTimeout || connectionTimeout,
        ssl: ssl ? ssl.toLowerCase() === 'true' : !!saslMechanism,
        sasl: saslMechanism
            ? {
                mechanism: saslMechanism,
                username: saslUsername,
                password: saslPassword
            }
            : undefined
    };

    // Additional SSL options. They can override the default SSL options.
    if (auth.tlsCA || auth.tlsKey || auth.tlsCert || sslRejectUnauthorized === 'true' || sslRejectUnauthorized === 'false') {
        config.ssl = {};
    }
    if (sslRejectUnauthorized === 'true' || sslRejectUnauthorized === 'false') {
        config.ssl = {
            rejectUnauthorized: sslRejectUnauthorized === 'true'
        };
    }
    if (auth.tlsCA) {
        try {
            tmpDir = tmp.dirSync();
            tmpFile = `${tmpDir.name}/ca.pem`;
            fs.writeFileSync(tmpFile, auth.tlsCA);
            config.ssl.ca = [auth.tlsCA];
        } catch (err) {
            if (connectionId) {
                await context.service.stateUnset(connectionId);
            }
            throw new Error(`Failed to create CA certificate: ${err.message}`);
        }
    }
    if (auth.tlsKey) {
        try {
            tmpDir = tmp.dirSync();
            tmpFile = `${tmpDir.name}/key.pem`;
            fs.writeFileSync(tmpFile, auth.tlsKey);
            config.ssl.key = fs.readFileSync(tmpFile, 'utf-8');
        } catch (err) {
            if (connectionId) {
                await context.service.stateUnset(connectionId);
            }
            throw new Error(`Failed to create Access Key: ${err.message}`);
        }
    }
    if (auth.tlsCert) {
        try {
            tmpDir = tmp.dirSync();
            tmpFile = `${tmpDir.name}/cert.pem`;
            fs.writeFileSync(tmpFile, auth.tlsCert);
            config.ssl.cert = fs.readFileSync(tmpFile, 'utf-8');
        } catch (err) {
            if (connectionId) {
                await context.service.stateUnset(connectionId);
            }
            throw new Error(`Failed to create Access Certificate: ${err.message}`);
        }
    }
    // If any SASL options are provided, ignore the SSL certificate options. Keep `rejectUnauthorized` if provided.
    if (saslMechanism) {
        delete config.ssl?.ca;
        delete config.ssl?.key;
        delete config.ssl?.cert;
    }

    // Return the Kafka client initialized with the configuration
    return new Kafka(config);
};

const cleanupEmpty = (obj) => {
    return Object.keys(obj).reduce((res, key) => {
        if (obj[key] !== undefined && !isNaN(obj[key])) { res[key] = obj[key]; }
        return res;
    }, {});
};

const loadConsumerOptions = function(context) {

    let retry = {
        maxRetryTime: parseInt(context.config.consumerRetryMaxRetryTime, 10),
        initialRetryTime: parseInt(context.config.consumerRetryInitialRetryTime, 10),
        factor: parseFloat(context.config.consumerRetryFactor),
        multiplier: parseFloat(context.config.consumerRetryMultiplier),
        retries: parseInt(context.config.consumerRetryRetries, 10)
    };

    let options = {
        sessionTimeout: parseInt(context.config.consumerSessionTimeout, 10),
        rebalanceTimeout: parseInt(context.config.consumerRebalanceTimeout, 10),
        heartbeatInterval: parseInt(context.config.consumerHeartbeatInterval, 10),
        metadataMaxAge: parseInt(context.config.consumerMetadataMaxAge, 10),
        allowAutoTopicCreation: context.config.consumerAllowAutoTopicCreation !== undefined ? context.config.consumerAllowAutoTopicCreation === 'true' : undefined,
        maxBytesPerPartition: parseInt(context.config.consumerMaxBytesPerPartition, 10),
        minBytes: parseInt(context.config.consumerMinBytes, 10),
        maxBytes: parseInt(context.config.consumerMaxBytes, 10),
        maxWaitTimeInMs: parseInt(context.config.consumerMaxWaitTimeInMs, 10),
        readUncommitted: context.config.consumerReadUncommitted !== undefined ? context.config.consumerReadUncommitted === 'true' : undefined,
        maxInFlightRequests: parseInt(context.config.consumerMaxInFlightRequests, 10),
        rackId: context.config.consumerRackId
    };

    options = cleanupEmpty(options);
    retry = cleanupEmpty(retry);

    if (Object.keys(retry).length) {
        options.retry = retry;
    }

    return options;
};

const addConsumer = async (context, topics, flowId, componentId, groupId, fromBeginning, auth, connId) => {

    // Genereate a unique consumer connection ID that differes between flow runs. Therefore, one setting
    // of the consumer followed by a flow stop and restart is not going to cause the job or message consumption
    // to consider the consumer is valid.
    const connectionId = connId || `consumer:${flowId}:${componentId}:${Math.random().toString(36).substring(7)}`;

    await context.service.stateSet(connectionId, {
        topics, flowId, componentId, groupId, fromBeginning, auth
    });

    const topicSubscriptions = topics?.AND.map(topic =>
        topic.topic.startsWith('/') ? RegexParser(topic.topic) : topic.topic
    );

    const client = await initClient(context, auth, connectionId);

    const consumerOptions = {
        ...loadConsumerOptions(context),
        groupId
    };

    await context.log('info', '[KAFKA] Kafka consumer options: ' + JSON.stringify(consumerOptions));
    const consumer = client.consumer(consumerOptions);

    await consumer.connect();
    KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId] = consumer;

    await consumer.subscribe({
        topics: topicSubscriptions,
        fromBeginning: fromBeginning || false
    });

    consumer.on(consumer.events.CRASH, async (error) => {
        await context.log('info', '[KAFKA] Kafka consumer CRASH (' + connectionId + '). Removing consumer from local connections.');
        await consumer.disconnect();
        delete KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId];
    });

    await consumer.run({
        eachBatchAutoResolve: false,
        // eachBatch has to be used instead of eachMessage because we don't want to resolve the
        // offset if connection to the consumer was removed from the cluster state.
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {

            // First, make sure the consumer is still needed. The flow might have stopped
            // which disconnected the consumer from open connections but only on one node in the cluster.
            // move connection out of the loop.
            const connection = await context.service.stateGet(connectionId);
            if (!connection) {
                await context.log('info', '[KAFKA] Kafka consumer connection is not available (' + connectionId + ').');
                return connectionId;
            }

            for (let message of batch.messages) {
                if (!isRunning() || isStale()) break;

                const normalizedMessage = normalizeMessageData(message);

                await context.triggerComponent(
                    flowId,
                    componentId,
                    normalizedMessage,
                    { enqueueOnly: 'true' }
                );

                resolveOffset(message.offset);
                await heartbeat();
            }
        }
    });

    return connectionId;
};

const normalizeMessageHeaders = (headers) => {

    const normalizedHeaders = {};
    if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
            normalizedHeaders[key] = Buffer.isBuffer(value) ? value.toString('utf8') : value || '';
        });
    }
    return normalizedHeaders;
};

const normalizeMessageData = (message) => {

    return {
        key: message.key ? message.key.toString() : null,
        value: message.value ? message.value.toString() : null,
        headers: normalizeMessageHeaders(message.headers || {})
    };
};

const addProducer = async (context, flowId, componentId, auth, connId) => {

    const connectionId = connId || `producer:${flowId}:${componentId}:${Math.random().toString(36).substring(7)}`;
    await context.service.stateSet(connectionId, {
        flowId, componentId, auth
    });
    const client = await initClient(context, auth, connectionId);
    const producer = client.producer();

    await producer.connect();
    KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId] = producer;

    return connectionId;
};

const sendMessage = async (context, flowId, componentId, connectionId, payload) => {

    let producer = KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId];
    if (!producer) {
        const connection = await context.service.stateGet(connectionId);
        await addProducer(context, flowId, componentId, connection.auth, connectionId);
        producer = KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId];
    }

    /**
     When acks is set to 0, the promise is not resolved causing `connection.sendMessage` call timeout.
     Considering the nature of `acks=0`, we can assume the message has been sent (unless no exceptions are thrown).
     From the Kafka docs:
     If (acks) set to zero then the producer will not wait for any acknowledgment from the server at all.
     The record will be immediately added to the socket buffer and considered sent.
     No guarantee can be made that the server has received the record in this case, and the

     https://kafka.apache.org/documentation/#producerconfigs_acks
     */
    if (payload.acks === '0') {
        producer.send(payload);
        return Promise.resolve({});
    }

    return await producer.send(payload);
};

const removeConnection = async (context, connectionId) => {

    await context.log('info', `[KAFKA] Removing connection ${connectionId}.`);
    await context.service.stateUnset(connectionId);
    const connection = KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId];
    if (!connection) return; // Connection doesn't exist, do nothing

    await connection.disconnect();
    delete KAFKA_CONNECTOR_OPEN_CONNECTIONS[connectionId];
};

const listConnections = () => { return KAFKA_CONNECTOR_OPEN_CONNECTIONS; };

const isConsumerConnection = (connectionId) => connectionId.startsWith('consumer:');

module.exports = {
    initClient,
    addConsumer,
    addProducer,
    sendMessage,
    removeConnection,
    listConnections,
    isConsumerConnection
};
