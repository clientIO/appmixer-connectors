'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const apiKey = context.auth.apiKey;
        const url = 'https://generativelanguage.googleapis.com/v1beta/models';
        const { data } = await context.httpRequest.get(url + `?key=${apiKey}`);
        return context.sendJson(data, 'out');
    },

    toSelectOptions(out) {
        return out.models.map(model => {
            return {
                label: lib.extractBaseModelId(model.name),
                value: lib.extractBaseModelId(model.name)
            };
        });
    }
};
