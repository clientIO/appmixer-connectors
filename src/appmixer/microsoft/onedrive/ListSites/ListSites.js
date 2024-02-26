'use strict';

const { listItems } = require('../commons');

module.exports = {

    async receive(context) {

        try {
            const sites = await listItems(context, 'sites?search=&');
            return context.sendJson({ sites }, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson({ sites: [] }, 'out');
            }
            context.log({ stage: 'Error', err });
            throw new Error(err);
        }
    },

    sitesToSelectArray({ sites }) {

        return sites.map((site) => {
            return { label: site.displayName, value: site.id };
        });
    }
};
