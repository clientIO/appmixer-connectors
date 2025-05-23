'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await lib.request(context, 'get', '/models');
        return context.sendJson({ models: data.data }, 'out');
    },

    toSelectOptions(out) {
        return out.models.map(model => {
            return { label: model.id, value: model.id };
        });
    }
};
