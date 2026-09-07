'use strict';

module.exports = {

    async receive(context) {

        const { id } = context.messages.in.content;

        if (!id) {
            throw new context.CancelError('ID is required!');
        }

        const method = 'DELETE';
        const url = `/api/data/v9.2/contacts(${id})`;
        await context.componentStaticCall('appmixer.microsoft.dynamics.MakeApiCall', 'out', {
            messages: { in: { url, method } }
        });

        return context.sendJson({}, 'out');
    }
};
