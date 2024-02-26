'use strict';

module.exports = {

    async start(context) {

        // register webhook in the slack plugin
        return context.service.stateAddToSet(
            context.properties.channelId,
            {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    },

    async stop(context) {

        return context.service.stateRemoveFromSet(
            context.properties.channelId,
            {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'message');
            return context.response();
        }
    }
};
