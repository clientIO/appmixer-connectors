'use strict';

module.exports = {

    async receive(context) {

        // Call UpdateObjectRecord with 'contact' as the entity name and 'data' as the data.
        if (!context.messages.in.content.id) {
            throw new context.CancelError('ID is required!');
        }

        const result = await context.componentStaticCall('appmixer.microsoft.dynamics.UpdateObjectRecord', 'out', {
            messages: { in: { objectName: 'contact', ...context.messages.in.content } },
            properties: context.properties
        });

        const { objectName, data, id, link, status, statusText } = result;

        return context.sendJson({ objectName, data, id, link, status, statusText }, 'out');
    }
};
