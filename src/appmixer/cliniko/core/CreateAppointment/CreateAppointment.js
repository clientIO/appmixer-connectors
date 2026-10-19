'use strict';

const lib = require('../../lib');

const RELATIONS = ['patient', 'practitioner', 'business', 'appointment_type', 'patient_case'];

module.exports = {

    async receive(context) {

        const {
            patientId, practitionerId, businessId, appointmentTypeId,
            startsAt, endsAt, notes, patientCaseId
        } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient is required!');
        }
        if (!practitionerId) {
            throw new context.CancelError('Practitioner is required!');
        }
        if (!businessId) {
            throw new context.CancelError('Business is required!');
        }
        if (!appointmentTypeId) {
            throw new context.CancelError('Appointment Type is required!');
        }
        if (!startsAt) {
            throw new context.CancelError('Starts At is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/individual_appointments',
            headers: { 'Content-Type': 'application/json' },
            data: lib.clean({
                patient_id: patientId,
                practitioner_id: practitionerId,
                business_id: businessId,
                appointment_type_id: appointmentTypeId,
                starts_at: startsAt,
                ends_at: endsAt,
                notes,
                patient_case_id: patientCaseId
            })
        });

        return context.sendJson(lib.expandIds(data, RELATIONS), 'out');
    }
};
