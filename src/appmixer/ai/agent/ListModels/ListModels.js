'use strict';

const provider = require('../provider');

module.exports = {

    receive: async function(context) {

        const models = await provider.listModels(context);
        return context.sendJson({ models }, 'out');
    },

    toSelectOptions(out) {
        return out.models.map(model => ({ label: model.id, value: model.id }));
    }
};
