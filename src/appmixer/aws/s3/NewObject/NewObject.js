'use strict';

const { ListObjectVersionsCommand } = require('@aws-sdk/client-s3');
const lib = require('../lib');

/**
 * Component which triggers whenever new object is created.
 * @extends {Component}
 */
module.exports = {

    start(context) {

        const { kmsMasterKeyId, trustedAccountIds } = context.properties;
        const payload = {
            topicPrefix: 'ObjectCreated_',
            eventPrefix: 's3:ObjectCreated:',
            eventType: 's3:ObjectCreated:*',
            kmsMasterKeyId,
            trustedAccountIds
        };
        return lib.registerWebhook(context, payload);
    },

    stop(context) {

        return lib.unregisterWebhook(context);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {

        const { bucket } = context.properties;
        const { s3 } = lib.init(context);

        const { headers, data } = context.messages.webhook.content;
        const payload = JSON.parse(data);

        if (headers && headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
            return lib.confirmSubscription(context, payload);
        }

        const message = JSON.parse(payload.Message);
        if (Array.isArray(message.Records)) {
            const results = await Promise.allSettled(message.Records.map(async record => {
                const { object } = record.s3;

                if (object) {
                    const versionsResponse = await s3.send(new ListObjectVersionsCommand({
                        Bucket: bucket,
                        Prefix: object.key,
                        MaxKeys: 10
                    }));

                    const Versions = versionsResponse.Versions || [];
                    const versions = Versions.filter(version => version.Key === object.key);

                    // We only want to trigger the first time the object is uploaded (i.e. it is the first and only version
                    // of the object in the bucket). If versioning is not enabled on the bucket, we trigger as well.
                    if (versions.length === 1 || versions.length === 0) {
                        object.Bucket = bucket;
                        object.EventType = record.eventName;
                        object.ObjectUrl = lib.getObjectUrl(bucket, object.key, context.properties.region);

                        const normalizedObjectKey = decodeURIComponent(object.key.replace(/\+/g, ' '));
                        object.key = normalizedObjectKey;

                        return context.sendJson(object, 'object');
                    }
                }
            }));

            // Check for any errors after all items have been processed
            const errors = results.filter(result => result.status === 'rejected');
            if (errors.length > 0) {
                throw errors[0].reason;
            }
        }

        return context.response();
    },

    /**
     * Flow Test Mode: emit one realistic item shaped exactly like receive() emits, built from
     * the most-recently-modified object in the configured bucket (read-only listObjectsV2).
     * @param {Context} context
     * @return {*}
     */
    async test(context) {

        const { bucket } = context.properties;
        const object = await lib.fetchLatestObject(context);
        if (!object) {
            throw new Error('No objects in the bucket to use as test data.');
        }

        object.Bucket = bucket;
        object.EventType = 'ObjectCreated:Put';
        object.ObjectUrl = lib.getObjectUrl(bucket, object.key, context.properties.region);
        object.key = decodeURIComponent(object.key.replace(/\+/g, ' '));

        return context.sendJson(object, 'object');
    }
};
