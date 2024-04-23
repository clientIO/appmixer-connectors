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

        await context.callAppmixer({

            endPoint: '/plugins/appmixer/kafka/connect/producer',
            method: 'POST',
            body: options
        });

        return context.sendJson(context.messages.in.content, 'out');
    }
};
