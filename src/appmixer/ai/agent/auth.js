'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                provider: {
                    type: 'select',
                    name: 'Provider',
                    tooltip: 'Select your AI provider.',
                    options: [
                        { value: 'openai', label: 'OpenAI' },
                        { value: 'anthropic', label: 'Anthropic' },
                        { value: 'google', label: 'Google (Gemini)' },
                        { value: 'google-vertex', label: 'Google Vertex AI' },
                        { value: 'mistral', label: 'Mistral' },
                        { value: 'xai', label: 'xAI (Grok)' },
                        { value: 'cohere', label: 'Cohere' },
                        { value: 'deepseek', label: 'DeepSeek' },
                        { value: 'groq', label: 'Groq' },
                        { value: 'perplexity', label: 'Perplexity' },
                        { value: 'togetherai', label: 'Together AI' },
                        { value: 'amazon-bedrock', label: 'Amazon Bedrock' },
                        { value: 'azure', label: 'Azure OpenAI' },
                        { value: 'openai-compatible', label: 'OpenAI-Compatible' }
                    ]
                },
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'API key for the selected provider. For <b>Amazon Bedrock</b> enter your <b>AWS Access Key ID</b> here.'
                },
                secretKey: {
                    type: 'text',
                    name: 'Secret Key',
                    tooltip: '<b>Amazon Bedrock only</b> — enter your <b>AWS Secret Access Key</b> here. Leave empty for all other providers.'
                },
                region: {
                    type: 'text',
                    name: 'Region',
                    tooltip: '<b>Amazon Bedrock</b>: AWS region (e.g. <code>us-east-1</code>). <b>Google Vertex AI</b>: Google Cloud region (e.g. <code>us-central1</code>). Leave empty for all other providers.'
                },
                projectId: {
                    type: 'text',
                    name: 'Project ID',
                    tooltip: '<b>Google Vertex AI only</b> — your Google Cloud project ID (e.g. <code>my-gcp-project</code>). Leave empty for all other providers.'
                },
                baseURL: {
                    type: 'text',
                    name: 'Base URL',
                    tooltip: 'Required for <b>Azure OpenAI</b> (e.g. <code>https://MY-RESOURCE.openai.azure.com</code>) and <b>OpenAI-Compatible</b> endpoints (e.g. <code>https://openrouter.ai/api/v1</code>, <code>https://api.groq.com/openai/v1</code>, <code>http://localhost:11434/v1</code>). Leave empty for all other providers.'
                },
                customHeaders: {
                    type: 'textarea',
                    name: 'Custom Headers',
                    tooltip: '(Optional) JSON object of extra HTTP headers sent with every request, e.g. <code>{"HTTP-Referer":"https://myapp.com","X-Title":"My App"}</code>. Useful for OpenRouter site attribution or provider-specific headers.'
                }
            },

            validate: async (context) => {

                const provider = context.provider || 'openai';

                // Providers that require non-standard credentials — validate by field presence only.
                if (provider === 'amazon-bedrock') {
                    if (!context.apiKey) throw new Error('AWS Access Key ID (API Key field) is required for Amazon Bedrock.');
                    if (!context.secretKey) throw new Error('AWS Secret Access Key (Secret Key field) is required for Amazon Bedrock.');
                    if (!context.region) throw new Error('AWS Region is required for Amazon Bedrock (e.g. us-east-1).');
                    return;
                }
                if (provider === 'google-vertex') {
                    if (!context.projectId) throw new Error('Google Cloud Project ID is required for Google Vertex AI.');
                    return;
                }

                // All other providers: validate by making a real models list call.
                // Lazy-require so the module is loaded at call time, not at startup.
                const { listModels } = require('./provider');
                await listModels(context);
            },

            accountNameFromProfileInfo: (context) => {

                const provider = context.provider || 'openai';
                const key = context.apiKey || '';
                const preview = key.length > 8
                    ? key.slice(0, 4) + '...' + key.slice(-4)
                    : '***';
                return `${provider} / ${preview}`;
            }
        };
    }
};
