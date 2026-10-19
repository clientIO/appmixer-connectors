'use strict';

const { InvokeAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            agentRuntimeArn,
            runtimeSessionId,
            payload,
            qualifier,
            runtimeUserId,
            contentType,
            accept
        } = context.messages.in.content;

        if (!agentRuntimeArn) {
            throw new context.CancelError('Agent Runtime ARN is required!');
        }
        if (!runtimeSessionId) {
            throw new context.CancelError('Runtime Session ID is required!');
        }
        if (payload === undefined || payload === null || payload === '') {
            throw new context.CancelError('Payload is required!');
        }

        const { dataClient } = lib.init(context);

        const params = {
            agentRuntimeArn,
            runtimeSessionId,
            contentType: contentType || 'application/json',
            accept: accept || 'application/json',
            payload: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload))
        };
        if (qualifier) {
            params.qualifier = qualifier;
        }
        if (runtimeUserId) {
            params.runtimeUserId = runtimeUserId;
        }

        const response = await dataClient.send(new InvokeAgentRuntimeCommand(params));

        // The response body is streamed - buffer it into a single string.
        const responseText = await lib.streamToString(response.response);

        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch (err) {
            responseJson = undefined;
        }

        return context.sendJson({
            response: responseText,
            responseJson,
            runtimeSessionId: response.runtimeSessionId || runtimeSessionId,
            contentType: response.contentType,
            statusCode: response.statusCode
        }, 'out');
    }
};
