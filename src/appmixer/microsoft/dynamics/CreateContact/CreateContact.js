'use strict';

module.exports = {

    async receive(context) {

        // Call CreateObjectRecord with 'contact' as the entity name and 'data' as the data.
        const result = await context.componentStaticCall('appmixer.microsoft.dynamics.CreateObjectRecord', 'out', {
            messages: { in: { objectName: 'contact', ...context.messages.in.content } },
            properties: context.properties
        });

        const { objectName, data, id, link, status, statusText } = result;

        return context.sendJson({ objectName, data, id, link, status, statusText }, 'out');
    }
};
