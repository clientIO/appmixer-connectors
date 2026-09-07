'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { patientId } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient ID is required!');
        }

        const patient = await fhirRequest(context, { resource: `Patient/${patientId}` });

        return context.sendJson(patient, 'out');
    }
};
