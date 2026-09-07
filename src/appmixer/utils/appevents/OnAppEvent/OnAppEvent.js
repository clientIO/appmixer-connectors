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
            return context.sendJson({ data: context.messages.webhook.content.data }, 'out');
        }
    },

    test(context) {

        // App-event webhook trigger: there is no upstream to fetch, but the user supplies a
        // representative event payload via the eventDataExample property (the same example
        // that drives the dynamic output schema). Emit it in the exact { data } shape
        // receive() emits for a real event.
        const example = context.properties.eventDataExample;
        if (!example) {
            throw new Error('No event data example configured to use as test data.');
        }

        let data;
        try {
            data = JSON.parse(example);
        } catch (err) {
            throw new Error('The configured event data example is not valid JSON.');
        }

        return context.sendJson({ data }, 'out');
    },

    getOutputPortOptions(context, eventDataExample) {

        let schema;

        try {
            const eventDataExampleJson = JSON.parse(eventDataExample);
            schema = GenerateSchema.json('App Event Data', eventDataExampleJson);
        } catch (err) {
            // noop
        }

        const output = [
            { label: 'Data', value: 'data', schema }
        ];

        return context.sendJson(output, 'out');
    }
};
