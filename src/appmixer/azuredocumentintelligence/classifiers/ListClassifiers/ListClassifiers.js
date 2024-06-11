'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;
const { isUnexpected, paginate } = require('@azure-rest/ai-document-intelligence');
const { sendArrayOutput } = require('../../lib');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { endpoint, apiKey } = context.config;
        const { outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const client = DocumentIntelligence(endpoint, { key: apiKey });
        const response = await client.path('/documentClassifiers').get();

        if (isUnexpected(response)) {
            throw response.body.error;
        }

        const modelsInAccount = [];
        for await (const model of paginate(client, response)) {
            modelsInAccount.push(model);
        }

        await sendArrayOutput({ context, outputType, records: modelsInAccount });
    }
};
