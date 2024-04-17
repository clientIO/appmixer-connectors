'use strict';

const RegexParser = require('regex-parser');
const { kafka } = require('./common.js');

let openConnections = {};

const initializeKafkaConsumer = ({ groupId, authDetails }) => {

    const kafkaMaster = kafka();
    kafkaMaster.init(authDetails);
    return kafkaMaster.createConsumer({ groupId });
};

const initializeKafkaProducer = (authDetails) => {

    const kafkaMaster = kafka();
    kafkaMaster.init(authDetails);
    return kafkaMaster.createProducer();
};

const processMessageHeaders = (headers) => {

    const processedHeaders = {};
    if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
            processedHeaders[key] = Buffer.isBuffer(value) ? value.toString('utf8') : value || '';
        });
    }
    return processedHeaders;
};

const processMessageData = (message) => {

    return {
        key: message.key.toString(),
        value: message.value.toString(),
        headers: processMessageHeaders(message.headers)
    };
};

const addConnection = async (context, component, mode) => {

    const { topics, flowId, componentId, fromBeginning, authDetails, groupId } = component;

    try {
        if (mode === 'consumer') {
            await addConsumerConnection(
                context,
                flowId,
                componentId,
                groupId,
                authDetails,
                topics,
                fromBeginning
            );
        } else if (mode === 'producer') {
            await addProducerConnection(flowId, componentId, authDetails);
        }
    } catch (error) {
        await handleConnectionError({ flowId, componentId }, error);
        throw error; // Re-throw the error to propagate it to the caller
    }
};

const addConsumerConnection = async (
    context,
    flowId,
    componentId,
    groupId,
    authDetails,
    topics,
    fromBeginning
) => {

    const topicSubscriptions = topics?.AND.map(topic =>
        topic.topic.startsWith('/') ? RegexParser(topic.topic) : topic.topic
    );
    const connectionId = `${flowId}:${componentId}`;
    if (openConnections[connectionId]) return; // Connection already exists, do nothing
    const connection = initializeKafkaConsumer({ groupId, authDetails });
    openConnections[connectionId] = connection;
    await connection.connect();
    await connection.subscribe({
        topics: topicSubscriptions,
        fromBeginning: fromBeginning || false
    });

    await connection.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({
            batch,
            resolveOffset,
            heartbeat,
            isRunning,
            isStale
        }) => {
            for (const message of batch.messages) {
                if (!isRunning() || isStale()) break;
                try {
                    await context.triggerComponent(
                        flowId,
                        componentId,
                        processMessageData(message),
                        { enqueueOnly: true }
                    );
                } catch (err) {
                    await handleTriggerComponentError({ flowId, componentId }, err);
                    break;
                }
                resolveOffset(message.offset);
                await heartbeat();
            }
        }
    });
};

const addProducerConnection = async (flowId, componentId, authDetails) => {

    const kafkaProducer = initializeKafkaProducer(authDetails);
    openConnections[`${flowId}:${componentId}`] = kafkaProducer;
    await kafkaProducer.connect();
};

const sendMessage = async ({ flowId, componentId, payload }) => {

    const connectionId = `${flowId}:${componentId}`;
    const connection = openConnections[connectionId];
    if (!connection) return; // Connection doesn't exist, do nothing

    try {
        await connection.send(payload);
    } catch (error) {
        await handleSendMessageError(connection, payload, error);
    }
};

const removeConnection = async (component) => {

    const connectionId = `${component.flowId}:${component.componentId}`;
    const connection = openConnections[connectionId];
    if (!connection) return; // Connection doesn't exist, do nothing

    await connection.disconnect();
    delete openConnections[connectionId];
};

const listConnections = () => Object.keys(openConnections);

// Error handling functions
const handleConnectionError = async (component, error) => {

    await removeConnection(component);
};

const handleTriggerComponentError = async (component, error) => {

    if (error.message === 'Flow stopped.' || error.message === 'Missing flow.') {
        await removeConnection(component);
    }
};

const handleSendMessageError = async (connection, payload, error) => {

    try {
        await connection.connect();
        await connection.send(payload);
    } catch (error) {
        throw error;
    }
};

module.exports = { addConnection, removeConnection, listConnections, sendMessage };
