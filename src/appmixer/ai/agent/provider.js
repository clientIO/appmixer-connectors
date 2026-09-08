'use strict';

// Curated model lists for providers that do not expose a public /models REST endpoint.
const CURATED_MODELS = {
    'perplexity': [
        'sonar-pro', 'sonar', 'sonar-reasoning-pro', 'sonar-reasoning',
        'sonar-deep-research', 'r1-1776'
    ],
    'amazon-bedrock': [
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-5-haiku-20241022-v1:0',
        'anthropic.claude-3-opus-20240229-v1:0',
        'amazon.nova-pro-v1:0',
        'amazon.nova-lite-v1:0',
        'amazon.nova-micro-v1:0',
        'meta.llama3-3-70b-instruct-v1:0',
        'meta.llama3-1-8b-instruct-v1:0',
        'mistral.mistral-large-2402-v1:0',
        'amazon.titan-text-premier-v1:0'
    ],
    'google-vertex': [
        'gemini-2.5-pro-preview-05-06',
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.0-flash',
        'gemini-2.0-flash-thinking-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b'
    ]
};

/**
 * Normalises auth fields from both validate context (fields on context directly)
 * and component context (fields under context.auth).
 */
function resolveAuth(context) {

    const src = context.auth || context;
    return {
        provider: src.provider || 'openai',
        apiKey: src.apiKey,
        secretKey: src.secretKey,
        region: src.region,
        projectId: src.projectId,
        baseURL: src.baseURL,
        customHeaders: src.customHeaders
    };
}

function parseHeaders(raw) {

    if (!raw) return undefined;
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
        throw new Error('Custom Headers must be valid JSON: ' + err.message);
    }
}

/**
 * Create a Vercel AI SDK LanguageModel for the given context.
 * Provider and credentials are read from context.auth.
 * To add a new provider: add a case here and the matching package to package.json.
 */
function createModel(context) {

    const { provider, apiKey, secretKey, region, projectId, baseURL, customHeaders } = resolveAuth(context);
    const modelId = context.properties.model;
    const headers = parseHeaders(customHeaders);

    switch (provider) {

    case 'openai': {
        const { createOpenAI } = require('@ai-sdk/openai');
        return createOpenAI({ apiKey, headers })(modelId);
    }
    case 'openai-compatible': {
        const { createOpenAI } = require('@ai-sdk/openai');
        return createOpenAI({ apiKey, baseURL, compatibility: 'compatible', headers })(modelId);
    }
    case 'anthropic': {
        const { createAnthropic } = require('@ai-sdk/anthropic');
        return createAnthropic({ apiKey, headers })(modelId);
    }
    case 'google': {
        const { createGoogleGenerativeAI } = require('@ai-sdk/google');
        return createGoogleGenerativeAI({ apiKey, headers })(modelId);
    }
    case 'mistral': {
        const { createMistral } = require('@ai-sdk/mistral');
        return createMistral({ apiKey, headers })(modelId);
    }
    case 'xai': {
        const { createXai } = require('@ai-sdk/xai');
        return createXai({ apiKey, headers })(modelId);
    }
    case 'cohere': {
        const { createCohere } = require('@ai-sdk/cohere');
        return createCohere({ apiKey, headers })(modelId);
    }
    case 'deepseek': {
        const { createDeepSeek } = require('@ai-sdk/deepseek');
        return createDeepSeek({ apiKey, headers })(modelId);
    }
    case 'groq': {
        const { createGroq } = require('@ai-sdk/groq');
        return createGroq({ apiKey, headers })(modelId);
    }
    case 'perplexity': {
        const { createPerplexity } = require('@ai-sdk/perplexity');
        return createPerplexity({ apiKey, headers })(modelId);
    }
    case 'togetherai': {
        const { createTogetherAI } = require('@ai-sdk/togetherai');
        return createTogetherAI({ apiKey, headers })(modelId);
    }
    case 'azure': {
        const { createAzure } = require('@ai-sdk/azure');
        const opt = { apiKey, headers };
        // Accept https://MY-RESOURCE.openai.azure.com and extract the resource name,
        // or pass through a fully custom baseURL.
        const azureMatch = baseURL && baseURL.match(/https?:\/\/([^.]+)\.openai\.azure\.com/i);
        if (azureMatch) {
            opt.resourceName = azureMatch[1];
        } else if (baseURL) {
            opt.baseURL = baseURL.replace(/\/$/, '') + '/openai';
        }
        return createAzure(opt)(modelId);
    }
    case 'amazon-bedrock': {
        const { createAmazonBedrock } = require('@ai-sdk/amazon-bedrock');
        return createAmazonBedrock({
            region: region || 'us-east-1',
            accessKeyId: apiKey,
            secretAccessKey: secretKey
        })(modelId);
    }
    case 'google-vertex': {
        const { createVertex } = require('@ai-sdk/google-vertex');
        return createVertex({
            project: projectId || process.env.GOOGLE_VERTEX_PROJECT,
            location: region || process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
        })(modelId);
    }
    default:
        throw new Error(`Unsupported AI provider: "${provider}"`);
    }
}

/**
 * List available models for the provider configured in context.auth.
 * Returns an array of { id } objects, normalised across providers.
 * For providers without a public listing endpoint, returns a curated list.
 * Works in both auth-validate context (fields on context) and component context (context.auth).
 */
async function listModels(context) {

    const { provider, apiKey, secretKey, region, projectId, baseURL, customHeaders } = resolveAuth(context);
    const extraHeaders = parseHeaders(customHeaders);

    const bearer = (key) => ({
        'Authorization': `Bearer ${key}`,
        ...extraHeaders
    });

    switch (provider) {

    case 'openai': {
        const { data } = await context.httpRequest.get(
            'https://api.openai.com/v1/models',
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'openai-compatible': {
        if (!baseURL) throw new Error('Base URL is required for OpenAI-compatible providers.');
        const { data } = await context.httpRequest.get(
            `${baseURL.replace(/\/$/, '')}/models`,
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'anthropic': {
        const { data } = await context.httpRequest.get(
            'https://api.anthropic.com/v1/models',
            {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    ...extraHeaders
                }
            }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'google': {
        const { data } = await context.httpRequest.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        return (data.models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => ({ id: m.name.replace('models/', '') }));
    }

    case 'mistral': {
        const { data } = await context.httpRequest.get(
            'https://api.mistral.ai/v1/models',
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'xai': {
        const { data } = await context.httpRequest.get(
            'https://api.x.ai/v1/models',
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'cohere': {
        const { data } = await context.httpRequest.get(
            'https://api.cohere.ai/v2/models',
            { headers: bearer(apiKey) }
        );
        return (data.models || [])
            .filter(m => (m.endpoints || []).includes('chat'))
            .map(m => ({ id: m.name }));
    }

    case 'deepseek': {
        const { data } = await context.httpRequest.get(
            'https://api.deepseek.com/v1/models',
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'groq': {
        const { data } = await context.httpRequest.get(
            'https://api.groq.com/openai/v1/models',
            { headers: bearer(apiKey) }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    case 'togetherai': {
        const { data } = await context.httpRequest.get(
            'https://api.together.xyz/v1/models',
            { headers: bearer(apiKey) }
        );
        // Together returns either { data: [...] } or a top-level array.
        const list = Array.isArray(data) ? data : (data.data || []);
        return list
            .filter(m => (m.type || '').toLowerCase() === 'chat' || !m.type)
            .map(m => ({ id: m.id || m.name }));
    }

    case 'perplexity': {
        // Perplexity does not expose a public models listing endpoint.
        return CURATED_MODELS['perplexity'].map(id => ({ id }));
    }

    case 'amazon-bedrock': {
        // Bedrock's listing API requires AWS Signature V4 signing.
        // Return a curated list of foundation models instead.
        return CURATED_MODELS['amazon-bedrock'].map(id => ({ id }));
    }

    case 'google-vertex': {
        // Vertex AI listing requires OAuth2 / ADC — return curated list.
        return CURATED_MODELS['google-vertex'].map(id => ({ id }));
    }

    case 'azure': {
        if (!baseURL) throw new Error('Base URL is required for Azure OpenAI.');
        const endpoint = baseURL.replace(/\/$/, '');
        const { data } = await context.httpRequest.get(
            `${endpoint}/openai/models?api-version=2024-02-01`,
            { headers: { 'api-key': apiKey, ...extraHeaders } }
        );
        return (data.data || []).map(m => ({ id: m.id }));
    }

    default:
        throw new Error(`Unsupported AI provider: "${provider}"`);
    }
}

module.exports = { createModel, listModels };
