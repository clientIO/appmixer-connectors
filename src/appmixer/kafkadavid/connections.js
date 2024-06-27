'use strict';

const { Kafka, CompressionTypes, CompressionCodecs } = require('kafkajs');
const RegexParser = require('regex-parser');

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
    const consumer = client.consumer({ groupId });

    OPEN_CONNECTIONS[connectionId] = consumer;
    await consumer.connect();

    await consumer.subscribe({
        topics: topicSubscriptions,
        fromBeginning: fromBeginning || false
    });

    await consumer.run({
        eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
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

    OPEN_CONNECTIONS[connectionId] = producer;
    await producer.connect();
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

const listConnections = () => OPEN_CONNECTIONS;


module.exports = { initClient, addConsumer, addProducer, sendMessage, removeConsumer, removeProducer, listConnections };
