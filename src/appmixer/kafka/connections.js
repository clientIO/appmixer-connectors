'use strict';

const RegexParser = require('regex-parser');
const { kafka } = require('./common.js');

const openConnections = {};
const inProgress = {};
const callbacks = {};

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
        key: message.key ? message.key.toString() : null,
        value: message.value ? message.value.toString() : null,
        headers: processMessageHeaders(message.headers)
    };
};

const addConnection = async (context, component, mode) => {

    const { topics, flowId, componentId, fromBeginning, authDetails, groupId } = component;
    authDetails.connectionTimeout = context.config.connectionTimeout;

    const connectionId = `${flowId}:${componentId}`;

    // If another connection operation is in progress for this connection ID, wait for it to complete
    if (inProgress[connectionId]) {
        return new Promise((resolve, reject) => {
            callbacks[connectionId].push({ resolve, reject });
        });
    }

    inProgress[connectionId] = true;
    callbacks[connectionId] = [];

    try {
        await context.service.stateSet(connectionId, { ...component, mode });

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
        } else {
            throw new Error(`Invalid mode: ${mode}`);
        }

        // Once the operation is complete, reset inProgress flag for this connection ID and resolve pending callbacks
        inProgress[connectionId] = false;
        while (callbacks[connectionId].length > 0) {
            callbacks[connectionId].pop().resolve();
        }
    } catch (error) {
        // If an error occurs, reset inProgress flag for this connection ID, reject pending callbacks, remove the connection, and throw the error
        inProgress[connectionId] = false;
        while (callbacks[connectionId].length > 0) {
            callbacks[connectionId].pop().reject(error);
        }
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

    const connectionId = `${flowId}:${componentId}`;

    const topicSubscriptions = topics?.AND.map(topic =>
        topic.topic.startsWith('/') ? RegexParser(topic.topic) : topic.topic
    );

    const connection = initializeKafkaConsumer({ groupId, authDetails });
    openConnections[connectionId] = connection;
    await connection.connect();
    await connection.subscribe({
        topics: topicSubscriptions,
        fromBeginning: fromBeginning || false
    });

    connection.on(connection.events.CRASH,  (error) => {
        throw error;
    })

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

    const connectionId = `${flowId}:${componentId}`;
    const kafkaProducer = initializeKafkaProducer(authDetails);
    openConnections[connectionId] = kafkaProducer;
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
