'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        if (context.messages.webhook) {
            await context.log({
                step: 'webhook',
                webhook: context.messages.webhook
            });

            let out = await lib.replaceRuntimeExpressions("$request.body", context, {}, context.messages.webhook
                .content);
            await context.sendJson(out, 'out');
            return context.response(out);
        }
    },

    start: async function(context) {

        // Subscribe to a static webhook events received via ../../plugin.js.
        return context.service.stateAddToSet(
            await lib.replaceRuntimeExpressions('meeting.started:{$connection.profile.account_id}',
            context, {}), {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    },

    stop: async function(context) {

        // Unsubscribe from a static webhook events received via ../../plugin.js.
        return context.service.stateRemoveFromSet(
            await lib.replaceRuntimeExpressions('meeting.started:{$connection.profile.account_id}',
            context, {}), {
                componentId: context.componentId,
                flowId: context.flowId
            }
        );
    }

};