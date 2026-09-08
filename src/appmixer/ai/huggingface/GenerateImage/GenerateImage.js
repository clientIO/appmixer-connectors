'use strict';

const pathModule = require('path');
const lib = require('../lib');

// Extension lookup only - the decision whether a response *is* an image is made on
// the `image/` prefix, so a provider answering with image/avif is not rejected.
const MIME_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/bmp': 'bmp'
};

// Leading bytes that identify the formats providers actually return inline. Used to
// label base64 payloads, which arrive with no content type of their own.
const MAGIC_BYTES = [
    { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mimeType: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
    { mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    { mimeType: 'image/bmp', bytes: [0x42, 0x4D] }
];

const DEFAULT_PROVIDER = 'fal-ai';

module.exports = {

    async receive(context) {

        const {
            model,
            provider,
            prompt,
            negativePrompt,
            width,
            height,
            numInferenceSteps,
            guidanceScale,
            fileName
        } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }

        const routeProvider = String(provider || DEFAULT_PROVIDER).trim();

        // Text-to-image is not part of the OpenAI compatible /v1 surface, and the
        // legacy hf-inference task route no longer serves it: popular checkpoints
        // answer 410 "deprecated and no longer supported by provider hf-inference".
        // Generation therefore goes through a named Inference Provider. The model is
        // that provider's own model path, so its slashes must survive into the URL —
        // it must not be repo-encoded.
        const url = `${lib.ROUTER_BASE_URL}/${routeProvider}/${String(model).replace(/^\/+/, '')}`;

        const data = buildPayload(routeProvider, {
            prompt, negativePrompt, width, height, numInferenceSteps, guidanceScale
        });

        let response;
        try {
            response = await context.httpRequest({
                method: 'POST',
                url,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiKey}`,
                    'Content-Type': 'application/json'
                },
                data,
                responseType: 'arraybuffer'
            });
        } catch (error) {
            // The request asked for an arraybuffer, so an error body arrives as raw
            // bytes and would otherwise surface as an unreadable array of numbers.
            throw new context.CancelError(describeHttpError(error, model, routeProvider));
        }

        const contentType = String(
            (response.headers && (response.headers['content-type'] || response.headers['Content-Type'])) || ''
        ).split(';')[0].trim().toLowerCase();

        let buffer;
        let mimeType = contentType;

        if (contentType.startsWith('image/')) {
            buffer = Buffer.from(response.data);
        } else {
            // Not an image content type — the provider answered with JSON.
            const payload = parseJsonBuffer(response.data);
            const remoteUrl = findImageUrl(payload);
            const base64 = findImageBase64(payload);

            if (remoteUrl) {
                const imageResponse = await context.httpRequest({
                    method: 'GET',
                    url: remoteUrl,
                    responseType: 'arraybuffer'
                });
                buffer = Buffer.from(imageResponse.data);
                mimeType = String(
                    (imageResponse.headers && imageResponse.headers['content-type']) || 'image/png'
                ).split(';')[0].trim().toLowerCase();
            } else if (base64) {
                buffer = Buffer.from(base64, 'base64');
                // Inline base64 carries no content type, so the format is read off the
                // payload rather than assumed to be PNG.
                mimeType = sniffImageMime(buffer) || 'image/png';
            } else {
                throw new context.CancelError(
                    `Model ${model} did not return an image. Pick a text-to-image model served by provider ${routeProvider}.`
                );
            }
        }

        const extension = MIME_EXTENSIONS[mimeType] || subtypeExtension(mimeType) || 'png';
        const name = fileName
            ? String(fileName)
            : `huggingface-image-${Date.now()}.${extension}`;

        const savedFile = await context.saveFileStream(pathModule.normalize(name), buffer);

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: name,
            contentType: mimeType || `image/${extension}`,
            size: buffer.length,
            model,
            provider: routeProvider
        }, 'out');
    }
};

/**
 * Build the request body for a provider. The legacy hf-inference route uses the
 * transformers task shape; every other Inference Provider takes the prompt at the
 * top level.
 * @param {string} provider
 * @param {object} options
 * @returns {object}
 */
function buildPayload(provider, options) {

    const { prompt, negativePrompt, width, height, numInferenceSteps, guidanceScale } = options;

    if (provider === 'hf-inference') {
        const parameters = {};
        if (negativePrompt) {
            parameters.negative_prompt = negativePrompt;
        }
        if (width) {
            parameters.width = Number(width);
        }
        if (height) {
            parameters.height = Number(height);
        }
        if (numInferenceSteps) {
            parameters.num_inference_steps = Number(numInferenceSteps);
        }
        if (guidanceScale !== undefined && guidanceScale !== null && guidanceScale !== '') {
            parameters.guidance_scale = Number(guidanceScale);
        }
        const body = { inputs: prompt };
        if (Object.keys(parameters).length > 0) {
            body.parameters = parameters;
        }
        return body;
    }

    const body = { prompt };
    if (negativePrompt) {
        body.negative_prompt = negativePrompt;
    }
    if (width && height) {
        body.image_size = { width: Number(width), height: Number(height) };
    }
    if (numInferenceSteps) {
        body.num_inference_steps = Number(numInferenceSteps);
    }
    if (guidanceScale !== undefined && guidanceScale !== null && guidanceScale !== '') {
        body.guidance_scale = Number(guidanceScale);
    }
    return body;
}

/**
 * Find a downloadable image URL in any of the provider response shapes.
 * @param {object|null} payload
 * @returns {string|null}
 */
function findImageUrl(payload) {

    if (!payload) {
        return null;
    }
    if (Array.isArray(payload.images) && payload.images[0]) {
        const first = payload.images[0];
        if (typeof first === 'string' && /^https?:\/\//.test(first)) {
            return first;
        }
        if (first && typeof first.url === 'string') {
            return first.url;
        }
    }
    if (Array.isArray(payload.output) && typeof payload.output[0] === 'string') {
        return payload.output[0];
    }
    if (Array.isArray(payload.data) && payload.data[0] && typeof payload.data[0].url === 'string') {
        return payload.data[0].url;
    }
    if (typeof payload.image_url === 'string') {
        return payload.image_url;
    }
    return null;
}

/**
 * Find inline base64 image data in any of the provider response shapes.
 * @param {object|null} payload
 * @returns {string|null}
 */
function findImageBase64(payload) {

    if (!payload) {
        return null;
    }
    if (Array.isArray(payload.data) && payload.data[0] && payload.data[0].b64_json) {
        return payload.data[0].b64_json;
    }
    if (Array.isArray(payload.images) && typeof payload.images[0] === 'string'
        && !/^https?:\/\//.test(payload.images[0])) {
        return payload.images[0];
    }
    if (typeof payload.image === 'string' && !/^https?:\/\//.test(payload.image)) {
        return payload.image;
    }
    return null;
}

/**
 * Identify an image buffer by its leading bytes. RIFF-based WebP needs the
 * container check, everything else is a fixed prefix.
 * @param {Buffer} buffer
 * @returns {string|null} the MIME type, or null when the format is unrecognised
 */
function sniffImageMime(buffer) {

    if (!buffer || buffer.length < 4) {
        return null;
    }

    for (const { mimeType, bytes } of MAGIC_BYTES) {
        if (bytes.every((byte, index) => buffer[index] === byte)) {
            return mimeType;
        }
    }

    if (buffer.length >= 12
        && buffer.toString('ascii', 0, 4) === 'RIFF'
        && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }

    // ISO base media container - AVIF and HEIC declare their brand in the ftyp box.
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
        const brand = buffer.toString('ascii', 8, 12);
        if (brand.startsWith('avi')) {
            return 'image/avif';
        }
        if (brand.startsWith('hei') || brand.startsWith('mif')) {
            return 'image/heic';
        }
    }

    return null;
}

/**
 * Derive a file extension from an unlisted `image/<subtype>` MIME type.
 * @param {string} mimeType
 * @returns {string|null}
 */
function subtypeExtension(mimeType) {

    const subtype = String(mimeType || '').split('/')[1];

    return /^[a-z0-9]+$/.test(subtype || '') ? subtype : null;
}

/**
 * Turn an axios error whose body is an arraybuffer into a readable message.
 * @param {Error} error
 * @param {string} model
 * @param {string} provider
 * @returns {string}
 */
function describeHttpError(error, model, provider) {

    const status = error.response && error.response.status;
    const parsed = error.response && parseJsonBuffer(error.response.data);
    let detail = parsed && (parsed.error || parsed.message);

    if (!detail && error.response && error.response.data) {
        detail = Buffer.from(error.response.data).toString('utf8').slice(0, 300);
    }
    if (!detail) {
        detail = error.message;
    }
    if (typeof detail === 'object') {
        detail = JSON.stringify(detail);
    }

    if (status === 410 || status === 400) {
        return `Provider ${provider} cannot serve model ${model}: ${detail}`;
    }
    return `Hugging Face image generation failed${status ? ` (HTTP ${status})` : ''}: ${detail}`;
}

/**
 * Decode a response body that was requested as an arraybuffer but turned out to
 * be JSON.
 * @param {Buffer|ArrayBuffer|string} raw
 * @returns {object|null}
 */
function parseJsonBuffer(raw) {

    try {
        return JSON.parse(Buffer.from(raw).toString('utf8'));
    } catch (error) {
        return null;
    }
}
