'use strict';

const DocumentIntelligence = require('@azure-rest/ai-document-intelligence').default;

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API key.'
            },
            endpoint: { type: 'text', name: 'endpoint', tooltip: 'The Document Intelligence service endpoint.' }
        },

        requestProfileInfo(context) {

            const { apiKey, endpoint } = context;

            return {
                name: `${endpoint} - ${apiKey.slice(0, 3)}***`
            };
        },

        accountNameFromProfileInfo: 'name',

        async validate(context) {

            if (!context.apiKey) throw 'The apiKey is not valid';

            const client = DocumentIntelligence(context.endpoint, { key: context.apiKey });
            const response = await client.path('/info').get();

            if (response.status === '200') return true;

            throw response.body.error || response.body;
        }
    }
};
