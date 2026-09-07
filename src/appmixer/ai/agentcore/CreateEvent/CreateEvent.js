'use strict';

const { CreateEventCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            memoryId, actorId, sessionId, role, messageText, payload, eventTimestamp
        } = context.messages.in.content;

        if (!memoryId) {
            throw new context.CancelError('Memory ID is required!');
        }
        if (!actorId) {
            throw new context.CancelError('Actor ID is required!');
        }

        let payloadValue;
        if (payload) {
            if (typeof payload === 'string') {
                try {
                    payloadValue = JSON.parse(payload);
                } catch (e) {
                    throw new context.CancelError('Invalid JSON in Payload: ' + e.message);
                }
            } else {
                payloadValue = payload;
            }
        } else if (messageText) {
            payloadValue = [{
                conversational: {
                    role: role || 'USER',
                    content: { text: messageText }
                }
            }];
        } else {
            throw new context.CancelError('Either Message Text or a raw Payload is required!');
        }

        const { dataClient } = lib.init(context);

        const params = {
            memoryId,
            actorId,
            payload: payloadValue,
            eventTimestamp: eventTimestamp ? new Date(eventTimestamp) : new Date()
        };
        if (sessionId) {
            params.sessionId = sessionId;
        }

        const response = await dataClient.send(new CreateEventCommand(params));

        return context.sendJson(response.event || {}, 'out');
    }
};
