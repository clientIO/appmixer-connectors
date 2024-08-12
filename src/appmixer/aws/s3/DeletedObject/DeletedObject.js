'use strict';
const Promise = require('bluebird');
const commons = require('../../aws-commons');

/**
 * Component which triggers whenever an object is deleted.
 * @extends {Component}
 */
module.exports = {

    start(context) {

        const payload = {
            topicPrefix: 'ObjectRemoved_',
            eventPrefix: 's3:ObjectRemoved:',
            eventType: 's3:ObjectRemoved:*'
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
                    object.Bucket = bucket;
                    object.EventType = record.eventName;

                    const normalizedObjectKey = decodeURIComponent(object.key.replace(/\+/g, ' '));
                    object.key = normalizedObjectKey;

                    return context.sendJson(object, 'deleted');
                }
            });
        }

        return context.response();
    }
};
