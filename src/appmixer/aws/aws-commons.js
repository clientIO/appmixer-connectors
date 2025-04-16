'use strict';
const AWS = require('aws-sdk');
const crypto = require('crypto');

module.exports = {

    init(context) {

        const region = context.messages.in?.content?.region || context.properties.region;

        AWS.config.update({
            signatureVersion: 'v4',
            region: region || 'us-east-1'
        });
        const { accessKeyId, secretKey } = context.auth;
        const credentials = new AWS.Credentials(accessKeyId, secretKey);

        const lambda = new AWS.Lambda({ apiVersion: '2015-03-31', credentials });
        const s3 = new AWS.S3({ apiVersion: '2006-03-01', credentials });
        const sns = new AWS.SNS({ apiVersion: '2010-03-31', credentials });

        return {
            lambda,
            s3,
            sns
        };
    },

    /**
     * Process items to find newly added.
     * @param {Set} knownItems
     * @param {Set} actualItems
     * @param {Set} newItems
     * @param {String} key
     * @param {Object} item
     */
    processItems(knownItems, actualItems, newItems, key, item) {

        if (knownItems && !knownItems.has(item[key])) {
            newItems.add(item);
        }
        actualItems.add(item[key]);
    },

    /**
     * Create and subscribe topic to AWS SNS.
     * @param {Context} context
     * @param {Object} payload
     * @param {string} payload.topicPrefix
     * @param {string} payload.eventPrefix
     * @param {string} payload.eventType
     * @return {Promise}
     */
    async registerWebhook(context, payload) {

        await this.unregisterWebhook(context);

        const { sns, s3 } = this.init(context);

        const { bucket } = context.properties;
        const url = context.getWebhookUrl();

        let topicARN;

        let lock;
        try {
            lock = await context.lock(context.auth.userId.toString(), {
                ttl: 1000 * 60,
                retryDelay: 500,
                maxRetryCount: 60
            });

            const { TopicConfigurations } = await s3.getBucketNotificationConfiguration({ Bucket: bucket }).promise();
            const filteredTopics = TopicConfigurations.filter(topic => topic.TopicArn.includes(payload.topicPrefix));


            if (filteredTopics.length > 0) {
                topicARN = filteredTopics[0].TopicArn;

                const state = await context.loadState();
                state.notificationInBucket = true;
                await context.saveState(state);
            } else {
                const response = await sns.createTopic({
                    Name: `${payload.topicPrefix}${crypto.randomBytes(10).toString('hex')}`
                }).promise();
                topicARN = response.TopicArn;

                await sns.setTopicAttributes({
                    TopicArn: topicARN,
                    AttributeName: 'Policy',
                    AttributeValue: `{"Version":"2008-10-17","Id":"__default_policy_ID","Statement":[{"Sid":"__console_pub_0",
                    "Effect":"Allow","Principal":{"AWS":"*"},"Action":"SNS:Publish","Resource":"${topicARN}"},
                    {"Sid":"__console_sub_0","Effect":"Allow","Principal":{"AWS":"*"},"Action":["SNS:Subscribe","SNS:Receive"],
                    "Resource":"${topicARN}"}]}`
                }).promise();

                const topicConfigurations = TopicConfigurations.filter(topic => {
                    const events = topic.Events.filter(arr => !arr.includes(payload.eventPrefix));
                    return events.length > 0;
                });

                topicConfigurations.push({
                    TopicArn: topicARN,
                    Events: [
                        payload.eventType
                    ]
                });

                await s3.putBucketNotificationConfiguration({
                    Bucket: bucket,
                    NotificationConfiguration: {
                        TopicConfigurations: topicConfigurations
                    }
                }).promise();
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }

        return sns.subscribe({ TopicArn: topicARN, Protocol: 'https', Endpoint: url }).promise();
    },

    /**
     * Delete registered notification and topicARN. If there is no topicARN in state, do nothing.
     * @param {Context} context
     * @return {Promise}
     */
    async unregisterWebhook(context) {

        const { topicARN, subscriptionArn, notificationInBucket } = await context.loadState();
        if (!topicARN || !subscriptionArn) {
            return Promise.resolve();
        }

        const { bucket } = context.properties;
        const { s3, sns } = this.init(context);

        let promises = [
            sns.unsubscribe({ SubscriptionArn: subscriptionArn }).promise()
        ];
        if (!notificationInBucket) {

            let lock;

            try {
                lock = await context.lock(context.auth.userId.toString(), {
                    ttl: 1000 * 60,
                    retryDelay: 500,
                    maxRetryCount: 60
                });

                // eslint-disable-next-line max-len
                const { TopicConfigurations } = await s3.getBucketNotificationConfiguration({ Bucket: bucket }).promise();
                const filteredTopics = TopicConfigurations.filter(topic => topic.TopicArn !== topicARN);
                await s3.putBucketNotificationConfiguration({
                    Bucket: bucket,
                    NotificationConfiguration: {
                        TopicConfigurations: filteredTopics
                    }
                }).promise();
            } finally {
                if (lock) {
                    await lock.unlock();
                }
            }

            promises.push(sns.deleteTopic({ TopicArn: topicARN }).promise());
        }

        return Promise.all(promises);
    },

    /**
     * Verifies an endpoint owner's intent to receive messages by validating the token sent to the endpoint.
     * @param {Context} context
     * @param {Object} payload
     * @return {Promise}
     */
    async confirmSubscription(context, payload) {

        const { sns } = this.init(context);

        const { TopicArn, Token } = payload;
        const { SubscriptionArn } = await sns.confirmSubscription({ TopicArn, Token }).promise();

        const state = await context.loadState();
        state.topicARN = TopicArn;
        state.subscriptionArn = SubscriptionArn;
        await context.saveState(state);

        return context.response();
    },

    /**
     * There is no SDK method for getting object URL, but we can put it together.
     * @param {string} bucket
     * @param {string} key
     * @param {?string} [region]
     * @return {string}
     */
    getObjectUrl(bucket, key, region = null) {

        if (!region) {
            return `https://${bucket}.s3.amazonaws.com/${key}`;
        }
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
};
