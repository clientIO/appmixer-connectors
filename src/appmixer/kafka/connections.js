'use strict';

const { Kafka, logLevel } = require('kafkajs');
const RegexParser = require('regex-parser');

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

const initClient = (context, auth) => {

    const {
        clientId,
        brokers,
        ssl,
        saslMechanism,
        saslUsername,
        saslPassword,
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
    return new Kafka(config);
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

    const client = initClient(context, auth);
    const consumer = client.consumer({ groupId });

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
            for (let message of batch.messages) {
                if (!isRunning() || isStale()) break;

                // First, make sure the consumer is still needed. The flow might have stopped
                // which disconnected the consumer from open connections but only on one node in the cluster.
                const connection = await context.service.stateGet(connectionId);
                if (!connection) break;

                const normalizedMessage = normalizeMessageData(message);

                await context.triggerComponent(
                    flowId,
                    componentId,
                    normalizedMessage,
                    { enqueueOnly: true }
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
    const client = initClient(context, auth);
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
    await producer.send(payload);
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
