'use strict';
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;

module.exports = {

    async receive(context) {

        const key = context.config.key || process.env.AZURE_COGNITIVE_SERVICES_KEY;
        const endpoint = context.config.endpoint || process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT;
        if (!key || !endpoint) {
            throw new context.CancelError('Missing key or endpoint. Please check your configuration.');
        }

        const apiKeyCredentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } });
        const computerVisionClient = new ComputerVisionClient(apiKeyCredentials, endpoint);

        const { imageUrl, language, maxCandidates } = context.messages.in.content;

        const description = await computerVisionClient.describeImage(imageUrl, {
            language: language,
            maxCandidates: maxCandidates
        });

        return context.sendJson(description, 'out');
    }
};
