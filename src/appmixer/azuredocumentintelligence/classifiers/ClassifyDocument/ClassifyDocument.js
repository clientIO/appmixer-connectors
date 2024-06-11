'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;
const { isUnexpected, getLongRunningPoller } = require('@azure-rest/ai-document-intelligence');

module.exports = {

    async receive(context) {

        const { endpoint, apiKey } = context.config;
        const { classifierId } = context.messages.in.content;

        const client = DocumentIntelligence(endpoint, { key: apiKey });
        const initialResponse = await client
            .path('/documentClassifiers/{classifierId}:analyze', classifierId)
            .post({
                contentType: 'application/json',
                body: {
                    urlSource: `https://d15f34w2p8l1cc.cloudfront.net/hearthstone/50241b011e3fb5ec0314535ff6e132faf69772f57590dc4c99570fce8d4ab79d.png`,
                }
            });

        if (isUnexpected(initialResponse)) {
            throw initialResponse.body.error;
        }

        const poller = await getLongRunningPoller(client, initialResponse);
        const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

        await context.sendJson(analyzeResult, 'out');
    }
};
