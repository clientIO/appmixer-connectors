'use strict';

module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        const result = await context.componentStaticCall('appmixer.microsoft.dynamics.MakeApiCall', 'out', {
            messages: { in: { url: `/api/data/v9.2/accounts(${id})`, method: 'GET' } }
        });

        return context.sendJson(result.response, 'out');
    }
};
