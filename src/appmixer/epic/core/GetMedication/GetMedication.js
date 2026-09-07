'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { medicationId } = context.messages.in.content;

        if (!medicationId) {
            throw new context.CancelError('Medication ID is required!');
        }

        const medication = await fhirRequest(context, { resource: `Medication/${medicationId}` });

        return context.sendJson(medication, 'out');
    }
};
