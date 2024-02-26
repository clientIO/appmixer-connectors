'use strict';

const GenerateSchema = require('generate-schema');

module.exports = {

    start(context) {

        return context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/appevents/triggers',
            method: 'POST',
            body: {
                event: context.properties.event,
                componentId: context.componentId,
                flowId: context.flowId
            }
        });
    },

    stop(context) {

        return context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/appevents/triggers/' + context.componentId,
            method: 'DELETE'
        });
    },

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.properties.eventDataExample);
        }

        if (context.messages.webhook) {
            await context.sendJson({ data: context.messages.webhook.content.data }, 'out');
            return context.response();
        }
    },

    getOutputPortOptions(context, eventDataExample) {

        let schema;

        try {
            const eventDataExampleJson = JSON.parse(eventDataExample);
            schema = GenerateSchema.json('App Event Data', eventDataExampleJson);
        } catch (err) {
            context.log({ step: 'Generate output variables from Event Data Example.', err: err.message, eventDataExample });
        }

        const output = [
            { label: 'Data', value: 'data', schema }
        ];

        return context.sendJson(output, 'out');
    }
};
