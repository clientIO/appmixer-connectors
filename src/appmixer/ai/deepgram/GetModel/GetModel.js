'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { modelId } = context.messages.in.content;

        if (!modelId) {
            throw new context.CancelError('Model ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/v1/models/${encodeURIComponent(modelId)}`
        });

        return context.sendJson(data, 'out');
    }
};
