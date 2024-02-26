'use strict';
const commons = require('../../aws-commons');

/**
 * Invoke Lambda function.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.invocationType);
        }

        const { name, invocationType, clientContext, logType, payload, qualifier } = context.messages.in.content;
        const { lambda } = commons.init(context);

        const params = {
            FunctionName: name,
            InvocationType: invocationType,
            // See https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html for clientContext usage.
            ClientContext: clientContext,
            LogType: logType,
            Payload: payload,
            Qualifier: qualifier
        };
        const { ExecutedVersion, FunctionError, LogResult, Payload, StatusCode } = await lambda.invoke(params).promise();

        return context.sendJson({ ExecutedVersion, FunctionError, LogResult, Payload, StatusCode }, 'out');
    },

    getOutputPortOptions(context, invocationType) {

        if (invocationType === 'Event' || invocationType === 'DryRun') {
            return context.sendJson([{ 'label': 'StatusCode', 'value': 'StatusCode' }], 'out');
        } else {
            // RequestResponse
            return context.sendJson([
                { 'label': 'StatusCode', 'value': 'StatusCode' },
                { 'label': 'FunctionError', 'value': 'FunctionError' },
                { 'label': 'LogResult', 'value': 'LogResult' },
                { 'label': 'Payload', 'value': 'Payload' },
                { 'label': 'ExecutedVersion', 'value': 'ExecutedVersion' }
            ], 'out');
        }
    }
};
