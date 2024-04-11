const RegexParser = require('regex-parser');
const { kafka } = require('./common.js');

let openConnections = {};

const initializeKafkaConsumer = ({ groupId, authDetails }) => {

    const kafkaMaster = kafka();
    kafkaMaster.init(authDetails);
    return kafkaMaster.createConsumer({ groupId });
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

const addConnection = async (context, component) => {

    const { topics, flowId, componentId, fromBeginning } = component;

    const topicSubscriptions = topics.AND.map(topic =>
        topic.topic.startsWith('/') ? RegexParser(topic.topic) : topic.topic
    );

    const connectionId = `${flowId}:${componentId}`;
    if (openConnections[connectionId]) return; // Connection already exists, do nothing

    let connection;
    try {
        connection = initializeKafkaConsumer(component);
        openConnections[connectionId] = connection;

        await connection.connect();
        await connection.subscribe({ topics: topicSubscriptions, fromBeginning: fromBeginning || false });

        await connection.run({
            eachBatchAutoResolve: false,
            eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
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
                        if (err.message === 'Flow stopped.' || err.message === 'Missing flow.') {
                            await removeConnection({ flowId, componentId });
                            break;
                        }
                    }
                    resolveOffset(message.offset);
                    await heartbeat();
                }
            }
        });
    } catch (error) {
        // Remove the connection from openConnections if an exception occurs
        await removeConnection({ flowId, componentId });
        throw error; // Re-throw the error to propagate it to the NewMessage component
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

module.exports = { addConnection, removeConnection, listConnections };
