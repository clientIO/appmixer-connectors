'use strict';

const { listItems } = require('../commons');


module.exports = {

    async receive(context) {

        try {
            const drives = await listItems(context, 'me/drives?');
            return context.sendJson({ drives }, 'out');
        } catch (err) {
            if (context.properties.variableFetch) {
                return context.sendJson({ drives: [] }, 'out');
            }
            context.log({ stage: 'Error', err });
            throw new Error(err);
        }
    },

    sitesToSelectArray({ drives }) {

        return drives.map((drive) => {
            return { label: `${drive.name || drive.driveType} / ${drive.webUrl || drive.id}`, value: drive.id };
        });
    }
};
