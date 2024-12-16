'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;
const { isUnexpected, getLongRunningPoller } = require('@azure-rest/ai-document-intelligence');

module.exports = {

    async receive(context) {

        const { endpoint, apiKey } = context.config;
        const { classifierId, fileId } = context.messages.in.content;

        const client = DocumentIntelligence(endpoint, { key: apiKey });

        let options;

        const fileInfo = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);
        options = {
            contentType: fileInfo.contentType || 'application/octet-stream',
            body: fileStream
        };

        await context.log({ step: 'Classifying document', endpoint, classifierId, fileId });
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
