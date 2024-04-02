'use strict';

const RegexParser = require('regex-parser');
const { kafka } = require('../../common');

let consumer;
let interval;
let lock;
let timeout;

module.exports = {

    async start(context) {

        await context.stateSet('ignoreNextTick', true);
    },

    async tick(context) {

        if (await context.stateGet('ignoreNextTick')) {
            await context.stateSet('ignoreNextTick', false);
            return;
        }

        try {
            lock = await context.lock('KafkaNewMessage-' + context.componentId, {
                ttl: 1000 * 60 * 1,
                maxRetryCount: 0
            });
        } catch (err) {
            return;
        }
        return new Promise(async resolve => {

            timeout = setTimeout(async () => {
                await disconnectConsumerAndReleaseLock(context);
                resolve();
            }, context.config.timeout || 1000 * 60 * 10);

            interval = setInterval(async () => {
                // Extend lock if necessary
                await lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 1);
            }, context.config.interval || 30000);

            consumer = initializeConsumer(context);

            const flowStatusCheckInterval = setInterval(async () => {
                // to get the `stage` of the flow
                try {
                    const resp = await context.callAppmixer({
                        endPoint: `/flows/${context.flowId}`,
                        method: 'GET',
                        qs: {
                            projection: 'stage'
                        }
                    });

                    if (resp.stage === 'stopped') {
                        await disconnectConsumerAndReleaseLock(context, flowStatusCheckInterval);
                    }
                } catch (error) {
                    // check response code for 404 and disconnet the consumer
                    if (error.response.status === 404) {
                        await disconnectConsumerAndReleaseLock(context, flowStatusCheckInterval);
                    }
                }
            }, context.config.flowStatusCheckInterval || 1000);

            await runConsumer(context);
        });
    }
};

async function disconnectConsumerAndReleaseLock(context, flowStatusCheckInterval) {

    if (consumer) {
        await context.log({ message: 'Disconnecting consumer...' });
        clearInterval(flowStatusCheckInterval);
        await consumer.disconnect();
        consumer = null;
        clearInterval(interval);
        clearTimeout(timeout);
        lock && await lock.unlock();
    }
}

function initializeConsumer(context) {

    const { groupId } = context.properties;
    const kafkaMaster = kafka();
    kafkaMaster.init(context.auth);
    return kafkaMaster.createConsumer({ groupId: groupId || `group-${context.componentId}:${context.flowId}` });
}

async function runConsumer(context) {

    const { topics } = context.properties;

    const topicSubscriptions = topics.AND.map(topic => {

        if (topic.topic.startsWith('/')) {
            return RegexParser(topic.topic);
        } else {
            return topic.topic;
        }
    });

    await consumer.connect();
    await consumer.subscribe({ topics: topicSubscriptions, fromBeginning: true });

    await consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {

            for (let message of batch.messages) {

                if (!isRunning() || isStale()) {
                    break;
                }
                await processMessage(context, message);
                resolveOffset(message.offset);
                await heartbeat();
            }
        }
    });
}

async function processMessage(context, message) {

    const headers = {};
    if (message.headers) {
        for (const key of Object.keys(message.headers)) {
            const header = message.headers[key];
            headers[key] = Buffer.isBuffer(header) ? header.toString('utf8') : (header || '');
        }
    }

    const out = {
        key: message.key.toString(),
        value: message.value.toString(),
        headers: headers
    };
    await context.sendJson(out, 'out');
}
