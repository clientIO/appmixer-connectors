'use strict';
const deepai = require('deepai');

module.exports = {

    async receive(context) {

        if (!context.auth.apiKey) {
            throw new Error('apiKey not set for deepai service.');
        }
        deepai.setApiKey(context.auth.apiKey);
        const params = context.messages.in.content;

        const res = await deepai.callStandardApi('image-similarity', {
            image1: params.image1,
            image2: params.image2
        });
        return context.sendJson(res, 'out');
    }
};
