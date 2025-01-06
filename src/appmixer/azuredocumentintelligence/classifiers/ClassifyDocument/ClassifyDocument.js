'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;
const { isUnexpected, getLongRunningPoller } = require('@azure-rest/ai-document-intelligence');

module.exports = {

    async receive(context) {

        const { endpoint, apiKey } = context.config;
        const { classifierId, fileUrl, base64Source } = context.messages.in.content;

        const client = DocumentIntelligence(endpoint, { key: apiKey });

        let options;

        if (fileUrl) {
            options = { body: { urlSource: fileUrl } };
        } else {
            options = { body: { base64Source } };
        }

        await context.log({ step: 'Classifying document', endpoint, classifierId, fileUrl, base64Source });
        const initialResponse = await client
            .path('/documentClassifiers/{classifierId}:analyze', classifierId)
            .post(options);

        if (isUnexpected(initialResponse)) {
            throw initialResponse.body.error;
        }

        const poller = await getLongRunningPoller(client, initialResponse);
        const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

        await context.sendJson(analyzeResult, 'out');
    }
};
