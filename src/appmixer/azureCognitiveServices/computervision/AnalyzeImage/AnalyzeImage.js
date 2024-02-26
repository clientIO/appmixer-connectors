'use strict';
const ComputerVisionClient = require('@azure/cognitiveservices-computervision').ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;

module.exports = {

    async receive(context) {

        let { imageUrl, language, visualFeatures } = context.messages.in.content;

        if (!visualFeatures) {
            visualFeatures =
                ['Categories', 'Tags', 'Description', 'Faces', 'ImageType', 'Color', 'Adult', 'Objects', 'Brands'];
        }

        if (!language) {
            language = 'en';
        }

        const key = context.config.key || process.env.AZURE_COGNITIVE_SERVICES_KEY;
        const endpoint = context.config.endpoint || process.env.AZURE_COGNITIVE_SERVICES_ENDPOINT;

        const apiKeyCredentials = new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } });
        const computerVisionClient = new ComputerVisionClient(apiKeyCredentials, endpoint);

        const analysis = await computerVisionClient.analyzeImage(
            imageUrl, { language: language, visualFeatures: visualFeatures });

        if (analysis.categories) {
            // Categories are not sorted by default.
            analysis.categories.sort((a, b) => b.score - a.score);
        }

        if (analysis.adult) {
            // Helper to make it easier to add conditions on OK content in flows without having to
            // use complicated logic expressions.
            analysis.adult.isOtherContent = !analysis.adult.isAdultContent
                && !analysis.adult.isRacyContent
                && !analysis.adult.isGoryContent;
        }

        return context.sendJson(analysis, 'out');
    }
};
