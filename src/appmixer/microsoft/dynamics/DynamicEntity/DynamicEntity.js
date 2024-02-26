'use strict';

const { getOutputPortOptions } = require('../dynamics-commons');

module.exports = {

    async receive(context) {

        // const { id, logicalName, logicalCollectionName } = context.messages.in.content;
        if (context.properties.generateOutputPortOptions) {
            const out = await getOutputPortOptions(context);
            return context.sendJson(out, 'out');
        }

        throw new context.CancelError('Unsupported operation');
    }
};
