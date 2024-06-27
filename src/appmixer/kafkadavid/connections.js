'use strict';

const { Kafka, CompressionTypes, CompressionCodecs } = require('kafkajs');
const RegexParser = require('regex-parser');

// [connectionId]: consumer/producer object
const OPEN_CONNECTIONS = {};

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

    await consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {

            debug(context, { type: 'consumer message received', topic, message });;

            await context.triggerComponent(
                flowId,
                componentId,
                normalizeMessageData(message),
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
        key: message.key.toString(),
        value: message.value.toString(),
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
        '35797d64-6470-4320-88ef-cbd71a3994ba',
        'affdbc8a-3de7-4c70-9024-7a1b78e57ea9', // ListOpenConnections
        msg,
        { enqueueOnly: true }
    );
};




module.exports = { initClient, addConsumer, addProducer, sendMessage, removeConsumer, removeProducer, listConnections, debug };
