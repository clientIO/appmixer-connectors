'use strict';

const { Kafka, CompressionTypes, CompressionCodecs } = require('kafkajs');
const RegexParser = require('regex-parser');

// [connectionId]: consumer/producer object

let OPEN_CONNECTIONS;
if (process.OPEN_CONNECTIONS) {
    OPEN_CONNECTIONS = process.OPEN_CONNECTIONS;
} else {
    process.OPEN_CONNECTIONS = OPEN_CONNECTIONS = {};
}

const initClient = (auth) => {

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
        brokers: brokers.split(',').map(broker => broker.trim()),
        connectionTimeout: auth.config?.connectionTimeout || connectionTimeout,
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

const addConsumer = async (context, topics, flowId, componentId, groupId, fromBeginning, auth) => {

    const connectionId = `consumer:${flowId}:${componentId}`;

    // TODO: Check if we already have a connectionId in OPEN_CONNECTIONS. If yes, that means that the connection removal didn't take place
    // during the flow stop method (something might have failed). In that case, we should first remove the old connection before
    // creating a new one.

    await context.service.stateSet(connectionId, {
        topics, flowId, componentId, groupId, fromBeginning, auth
    });

    const topicSubscriptions = topics?.AND.map(topic =>
        topic.topic.startsWith('/') ? RegexParser(topic.topic) : topic.topic
    );

    auth.connectionTimeout = context.config.connectionTimeout;
    const client = initClient(auth);
    debug(context, { type: 'client initialized', auth });;
    const consumer = client.consumer({ groupId });

    await consumer.connect();
    OPEN_CONNECTIONS[connectionId] = consumer;
    debug(context, { type: 'consumer connected', connectionId, OPEN_CONNECTIONS });;

    await consumer.subscribe({
        topics: topicSubscriptions,
        fromBeginning: fromBeginning || false
    });

    debug(context, { type: 'consumer subscribed', topics, fromBeginning });;

    consumer.on(consumer.events.CRASH, async (error) => {

        await context.log('info', 'Kafka consumer CRASH. Removing consumer from open connections list.');

        debug(context, { type: 'consumer CRASH', error });

        delete OPEN_CONNECTIONS[connectionId];
    });

    await consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {

            debug(context, { type: 'consumer message received', topic, message });;

            const normalizedMessage = normalizeMessageData(message);
            normalizedMessage.partition = partition;
            normalizedMessage.pid = process.pid;

            await context.triggerComponent(
                flowId,
                componentId,
                normalizedMessage,
                { enqueueOnly: true }
            );
        }
    });
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
        headers: normalizeMessageHeaders(message.headers)
    };
};

const addProducer = async (context, flowId, componentId, auth) => {

    const connectionId = `producer:${flowId}:${componentId}`;
    await context.service.stateSet(connectionId, {
        flowId, componentId, auth
    });
    auth.connectionTimeout = context.config.connectionTimeout;
    const client = initClient(auth);
    const producer = client.producer();

    await producer.connect();
    OPEN_CONNECTIONS[connectionId] = producer;
};

const sendMessage = async (flowId, componentId, payload) => {

    const connectionId = `producer:${flowId}:${componentId}`;
    const producer = OPEN_CONNECTIONS[connectionId];
    if (!producer) return; // Connection doesn't exist, do nothing
    await producer.send(payload);
};

const removeConnection = async (entity, context, flowId, componentId) => {

    const connectionId = `${entity}:${flowId}:${componentId}`;
    await context.service.stateUnset(connectionId);
    const connection = OPEN_CONNECTIONS[connectionId];
    if (!connection) return; // Connection doesn't exist, do nothing

    await connection.disconnect();
    delete OPEN_CONNECTIONS[connectionId];
};

const removeProducer = async (context, flowId, componentId) => {
    return removeConnection('producer', context, flowId, componentId);
};

const removeConsumer = async (context, flowId, componentId) => {
    return removeConnection('consumer', context, flowId, componentId);
};

const listConnections = () => { return OPEN_CONNECTIONS; };

const debug = function(context, msg) {
    return context.triggerComponent(
        context.config.debugFlowId || '35797d64-6470-4320-88ef-cbd71a3994ba',
        context.config.debugComponentId || 'affdbc8a-3de7-4c70-9024-7a1b78e57ea9', // ListOpenConnections
        msg,
        { enqueueOnly: true }
    );
};




module.exports = { initClient, addConsumer, addProducer, sendMessage, removeConsumer, removeProducer, listConnections, debug };
