'use strict';
const { Kafka } = require('kafkajs');

const kafka = () => {
    let kafkaClient = null;
    let producer = null;
    let consumer = null;

    const init = (options = {}) => {

        const { clientId, brokers, ssl, saslMechanism, saslUsername, saslPassword } = options;
        const config = {
            clientId,
            brokers: brokers.split(',').map(broker => broker.trim()),
            connectionTimeout: 10000,
            ssl: ssl ? ssl.toLowerCase() === 'true' : !!saslMechanism,
            sasl: saslMechanism
                ? {
                    mechanism: saslMechanism,
                    username: saslUsername,
                    password: saslPassword
                }
                : undefined
        };
        if (!kafkaClient) {
            kafkaClient = new Kafka(config);
        }
        return kafkaClient;
    };

    const authenticateAdmin = async () => {

        if (!kafkaClient) throw new Error('Kafka client not created');
        const admin = kafkaClient.admin();
        try {
            await admin.connect();
            return !!await admin.describeCluster();
        } finally {
            await admin.disconnect();
        }
    };

    const createTopic = async (topic) => {

        if (!kafkaClient) throw new Error('Kafka client not created');
        const admin = kafkaClient.admin();
        try {
            await admin.connect();
            await admin.createTopics({ topics: [{ topic }] });
        } finally {
            await admin.disconnect();
        }
    };

    const createProducer = ({ createPartitioner = undefined, retry = undefined } = {}) => {

        if (!kafkaClient) throw new Error('Kafka client not created');
        if (producer) throw new Error('Producer already created');
        producer = kafkaClient.producer({ createPartitioner, retry });
        return producer;
    };

    // Connect producer, producer must exists(use createProducer).
    const connectProducer = async () => {

        if (!producer) throw new Error('Producer not created');
        await producer.connect();
    };

    // Disconnect producer, producer must exists(use connectProducer).
    const disconnectProducer = async () => {

        if (!producer) throw new Error('Producer not created');
        await producer.disconnect();
    };

    // Send message, Producer must be connected(use connectProducer).
    const send = async (params) => {

        if (!producer) throw new Error('Producer not created');
        await producer.send(params);
    };

    const createConsumer = ({ groupId }) => {

        if (consumer) throw new Error('Consumer already created');
        consumer = kafkaClient.consumer({ groupId });
        return consumer;
    };

    // Connect consumer, consumer must exist(use createConsumer).
    const connectConsumer = async () => {

        if (!consumer) throw new Error('Consumer not created');
        await consumer.connect();
    };

    // Disconnect consumer, producer must exists(use connectConsumer).
    const disconnectConsumer = async () => {

        if (!consumer) throw new Error('Consumer not created');
        await consumer.disconnect();
    };

    // Subscribe consumer, consumer must be connected(use connectConsumer).
    const subscribeConsumer = async ({ topics, fromBeginning = true }) => {

        if (!consumer) throw new Error('Consumer not created');
        await consumer.subscribe({ topics, fromBeginning });
    };

    // Handle messages from subscribed consumer
    const handleConsumerMsg = async ({ eachMessageHandler, batchMessageHandler, eachBatchAutoResolve = false }) => {

        if (eachMessageHandler) {
            await consumer.run({ eachMessage: eachMessageHandler });
        } else {
            await consumer.run({ eachBatchAutoResolve, eachBatch: batchMessageHandler });
        }
    };

    return {
        init,
        authenticateAdmin,
        createTopic,
        createProducer,
        connectProducer,
        disconnectProducer,
        send,
        createConsumer,
        connectConsumer,
        disconnectConsumer,
        subscribeConsumer,
        handleConsumerMsg
    };
};

module.exports = { kafka };
