'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;
const { isUnexpected, getLongRunningPoller } = require('@azure-rest/ai-document-intelligence');

module.exports = {

    async receive(context) {

        const { endpoint, apiKey } = context.config;
        const { classifierId, fileId, fileUrl, base64Source } = context.messages.in.content;

        const client = DocumentIntelligence(endpoint, { key: apiKey });

        let options;

        if (fileId) {
            // Using "Classify Document From Stream" operation from "Document Classifiers" API
            const fileInfo = await context.getFileInfo(fileId);
            const fileStream = await context.getFileReadStream(fileId);
            options = {
                contentType: fileInfo.contentType || 'application/octet-stream',
                body: fileStream
            };
        } else {
            // Using "Classify Document" operation from "Document Classifiers" API
            if (fileUrl) {
                options = { body: { urlSource: fileUrl } };
            } else {
                options = { body: { base64Source } };
            }
        }

        await context.log({ step: 'Classifying document', endpoint, classifierId, fileId, fileUrl, base64Source });
        const initialResponse = await client
            .path('/documentClassifiers/{classifierId}:analyze', classifierId)
            .post(options);

        if (isUnexpected(initialResponse)) {
            throw initialResponse.body.error;
        }

        const poller = await getLongRunningPoller(client, initialResponse);
        await context.log({ step: 'Polling for result', result: initialResponse.body });

        const analyzeResult = (await poller.pollUntilDone()).body.analyzeResult;

        await context.sendJson(analyzeResult, 'out');
    }
};
