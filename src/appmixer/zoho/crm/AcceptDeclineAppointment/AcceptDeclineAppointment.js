'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

/**
 * Accept or decline an appointment. Zoho CRM has no dedicated accept/decline action on the
 * Appointments module, so accepting confirms the appointment is scheduled and declining moves it
 * to the cancelled status together with the optional cancellation reason and note.
 */
module.exports = {

    async receive(context) {

        const { appointmentId, decision, cancellationReason, cancellationNote } = context.messages.in.content;

        if (!appointmentId) {
            throw new context.CancelError('Appointment ID is required!');
        }
        if (!decision) {
            throw new context.CancelError('Decision is required!');
        }

        const declined = decision === 'decline';
        const appointment = {
            id: appointmentId,
            Status: declined ? lib.APPOINTMENT_STATUS_CANCELLED : lib.APPOINTMENT_STATUS_SCHEDULED
        };
        if (declined && cancellationReason) {
            appointment.Cancellation_Reason = cancellationReason;
        }
        if (declined && cancellationNote) {
            appointment.Cancellation_Note = cancellationNote;
        }

        // The Appointments module is only exposed from API v5 up, hence the version override.
        const client = new ZohoClient(context, undefined, { apiVersion: lib.APPOINTMENTS_API_VERSION });
        const { details } = await client.executeRecordsRequest('PUT', lib.APPOINTMENTS_MODULE, [appointment]);

        return context.sendJson({
            id: details.id,
            Status: appointment.Status,
            Modified_Time: details.Modified_Time
        }, 'out');
    }
};
