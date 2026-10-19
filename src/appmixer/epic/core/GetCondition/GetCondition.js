'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { conditionId } = context.messages.in.content;

        if (!conditionId) {
            throw new context.CancelError('Condition ID is required!');
        }

        const condition = await fhirRequest(context, { resource: `Condition/${conditionId}` });

        return context.sendJson(condition, 'out');
    }
};
