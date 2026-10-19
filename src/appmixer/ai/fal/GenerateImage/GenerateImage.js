'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            endpointId = 'fal-ai/flux/schnell',
            prompt,
            imageSize,
            numImages,
            seed,
            outputFormat,
            numInferenceSteps,
            enableSafetyChecker
        } = context.messages.in.content;

        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }
        if (!endpointId) {
            throw new context.CancelError('Model Endpoint Id is required!');
        }

        const body = { prompt };
        if (imageSize) {
            body.image_size = imageSize;
        }
        if (numImages !== undefined && numImages !== null && numImages !== '') {
            body.num_images = Number(numImages);
        }
        if (seed !== undefined && seed !== null && seed !== '') {
            body.seed = Number(seed);
        }
        if (outputFormat) {
            body.output_format = outputFormat;
        }
        if (numInferenceSteps !== undefined && numInferenceSteps !== null && numInferenceSteps !== '') {
            body.num_inference_steps = Number(numInferenceSteps);
        }
        if (enableSafetyChecker !== undefined) {
            body.enable_safety_checker = enableSafetyChecker;
        }

        const response = await lib.request(context, {
            method: 'POST',
            url: `${lib.RUN_URL}/${endpointId}`,
            headers: {
                ...lib.authHeaders(context),
                'Content-Type': 'application/json'
            },
            data: body,
            timeout: 60000
        });

        await lib.logInference(context, response);

        const data = response.data || {};
        return context.sendJson({
            images: data.images || [],
            seed: data.seed,
            has_nsfw_concepts: data.has_nsfw_concepts || [],
            requestId: response.headers['x-fal-request-id']
        }, 'out');
    }
};
