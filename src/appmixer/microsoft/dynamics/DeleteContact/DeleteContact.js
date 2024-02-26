'use strict';

module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;
        const method = 'DELETE';
        const url = `/api/data/v9.2/contacts(${id})`;
        const result = await context.componentStaticCall('appmixer.microsoft.dynamics.MakeApiCall', 'out', {
            messages: { in: { url, method } }
        });

        return context.sendJson(result, 'out');
    }
};
