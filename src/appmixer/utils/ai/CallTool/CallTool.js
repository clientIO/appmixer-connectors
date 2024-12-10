'use strict';

module.exports = {

    receive: async function(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        if (context.messages.webhook) {
            // Tool chain triggered by AI Agent.
            await context.sendJson(context.messages.webhook.content.data, 'out');
            return context.response({});
        }
    },

    getOutputPortOptions(context) {

        const options = [];
        context.properties.parameters.ADD.forEach(parameter => {
            options.push({ label: parameter.name, value: parameter.name, schema: { type: parameter.type } });
        });
        return context.sendJson(options, 'out');
    }
};
