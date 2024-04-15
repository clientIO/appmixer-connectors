'use strict';
const { CompressionTypes, CompressionCodecs } = require('kafkajs');
const SnappyCodec = require('kafkajs-snappy');

function registerCompressionCodec(compression) {

    switch (compression) {
        case 'Snappy':
            CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
            break;
        default:
            break;
    }
}

module.exports = {

    async stop(context) {

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/connect/producer/${context.flowId}/${context.componentId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'out');
        }

        const {
            topic,
            key,
            value,
            acks,
            timeout,
            compression,
            partition,
            timestamp,
            headers
        } = context.messages.in.content;

        if (compression) registerCompressionCodec(compression);

        const options = {
            authDetails: context.auth,
            topic,
            messages: [
                {
                    key,
                    value,
                    partition,
                    timestamp: timestamp && new Date(timestamp).getTime(),
                    headers: headers && JSON.parse(headers)
                }
            ],
            acks,
            timeout,
            compression: compression && CompressionTypes[compression],
            componentId: context.componentId,
            flowId: context.flowId
        };

        return context.callAppmixer({

            endPoint: '/plugins/appmixer/kafka/connect/producer',
            method: 'POST',
            body: options
        });
    }
};
