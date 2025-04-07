'use strict';
const { makeRequest } = require('../common');

module.exports = {

    async receive(context) {

        const { siteId } = context.messages.in.content;
        const { value: drives } = await makeRequest(
            {
                url: `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
                method: 'GET',
                body: null
            },
            context
        );

        return context.sendJson({ drives }, 'out');
    },

    drivesToSelectArray({ drives }) {
        if (!drives) {
            return [];
        }

        return drives.map((drive) => {
            return { label: drive.name, value: drive.id };
        });
    }
};
