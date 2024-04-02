'use strict';
const { CompressionTypes, CompressionCodecs } = require('kafkajs');
const SnappyCodec = require('kafkajs-snappy');

const { kafka } = require('../../common');

const registerCompressionCodec = (type) => {

    switch (type) {
        case 'Snappy':
            CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
            break;
        default:
            break;
    }
};

module.exports = {

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
            compression: compression && CompressionTypes[compression]
        };

        const kafkaMaster = kafka();
        kafkaMaster.init(context.auth);
        kafkaMaster.createProducer();
        await kafkaMaster.connectProducer();
        await kafkaMaster.send(options);
        await kafkaMaster.disconnectProducer();
        return await context.sendJson(context.messages.in.content, 'out');
    }
};
