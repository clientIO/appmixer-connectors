'use strict';

const lib = require('../../lib');

const RELATIONS = ['patient', 'practitioner', 'business', 'appointment_type', 'patient_case'];

module.exports = {

    async receive(context) {

        const { appointmentId } = context.messages.in.content;

        if (!appointmentId) {
            throw new context.CancelError('Appointment is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/individual_appointments/${encodeURIComponent(appointmentId)}`
        });

        return context.sendJson(lib.expandIds(data, RELATIONS), 'out');
    }
};
