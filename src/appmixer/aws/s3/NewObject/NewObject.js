'use strict';
const Promise = require('bluebird');
const commons = require('../../aws-commons');

/**
 * Component which triggers whenever new object is created.
 * @extends {Component}
 */
module.exports = {

    start(context) {

        const payload = {
            topicPrefix: 'ObjectCreated_',
            eventPrefix: 's3:ObjectCreated:',
            eventType: 's3:ObjectCreated:*'
        };
        return commons.registerWebhook(context, payload);
    },

    stop(context) {

        return commons.unregisterWebhook(context);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {

        const { bucket } = context.properties;
        const { s3 } = commons.init(context);

        const { headers, data } = context.messages.webhook.content;
        const payload = JSON.parse(data);

        if (headers && headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
            return commons.confirmSubscription(context, payload);
        }

        const message = JSON.parse(payload.Message);
        if (Array.isArray(message.Records)) {
            await Promise.map(message.Records, async record => {
                const { object } = record.s3;

                if (object) {
                    const { Versions = [] } = await s3.listObjectVersions({
                        Bucket: bucket,
                        Prefix: object.key,
                        MaxKeys: 10
                    }).promise();

                    const versions = Versions.filter(version => version.Key === object.key);

                    // We only want to trigger the first time the object is uploaded (i.e. it is the first and only version
                    // of the object in the bucket). If versioning is not enabled on the bucket, we trigger as well.
                    if (versions.length === 1 || versions.length === 0) {
                        object.Bucket = bucket;
                        object.EventType = record.eventName;
                        object.ObjectUrl = commons.getObjectUrl(bucket, object.key, context.properties.region);

                        const normalizedObjectKey = decodeURIComponent(object.key.replace(/\+/g, ' '));
                        object.key = normalizedObjectKey;

                        return context.sendJson(object, 'object');
                    }
                }
            });
        }

        return context.response();
    }
};
