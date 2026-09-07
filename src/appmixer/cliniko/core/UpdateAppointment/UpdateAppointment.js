'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            appointmentId, startsAt, endsAt, notes,
            practitionerId, businessId, appointmentTypeId, patientCaseId
        } = context.messages.in.content;

        if (!appointmentId) {
            throw new context.CancelError('Appointment is required!');
        }

        await lib.apiRequest(context, {
            method: 'PATCH',
            path: `/individual_appointments/${encodeURIComponent(appointmentId)}`,
            headers: { 'Content-Type': 'application/json' },
            data: lib.clean({
                starts_at: startsAt,
                ends_at: endsAt,
                notes,
                practitioner_id: practitionerId,
                business_id: businessId,
                appointment_type_id: appointmentTypeId,
                patient_case_id: patientCaseId
            })
        });

        return context.sendJson({}, 'out');
    }
};
