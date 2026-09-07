'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { appointmentId, cancellationReason, cancellationNote } = context.messages.in.content;

        if (!appointmentId) {
            throw new context.CancelError('Appointment is required!');
        }

        await lib.apiRequest(context, {
            method: 'PATCH',
            path: `/individual_appointments/${encodeURIComponent(appointmentId)}/cancel`,
            headers: { 'Content-Type': 'application/json' },
            data: lib.clean({
                cancellation_reason: cancellationReason,
                cancellation_note: cancellationNote
            })
        });

        return context.sendJson({}, 'out');
    }
};
