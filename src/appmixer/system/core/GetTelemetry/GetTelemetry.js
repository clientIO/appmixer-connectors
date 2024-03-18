'use strict';

module.exports = {

    receive: async function(context) {

        const { from, to } = context.messages.in.content;
        const telemetry = await context.callAppmixer({ endPoint: `/telemetry?from=${from}&to=${to}`, method: 'GET' });
        return context.sendJson(telemetry, 'out');
    }
};
