'use strict';

module.exports = {

    receive: async function(context) {

        const { flowId } = context.messages.in.content;
        const flow = await context.callAppmixer({ endPoint: '/flows/' + flowId, method: 'GET' });
        return context.sendJson(flow, 'out');
    }
};
