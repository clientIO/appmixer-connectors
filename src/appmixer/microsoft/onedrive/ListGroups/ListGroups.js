'use strict';

const { listItems } = require('../commons');


module.exports = {

    async receive(context) {

        try {
            const groups = await listItems(context, 'groups?');
            return context.sendJson({ groups }, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson({ groups: [] }, 'out');
            }
            context.log({ stage: 'Error', err });
            throw new Error(err);
        }

    },

    sitesToSelectArray({ groups }) {

        return groups.map((group) => {
            return { label: group.displayName, value: group.id };
        });
    }
};
