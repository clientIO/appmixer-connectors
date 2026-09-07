'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { medicationRequestId } = context.messages.in.content;

        if (!medicationRequestId) {
            throw new context.CancelError('Medication Request ID is required!');
        }

        const medicationRequest = await fhirRequest(context, { resource: `MedicationRequest/${medicationRequestId}` });

        return context.sendJson(medicationRequest, 'out');
    }
};
