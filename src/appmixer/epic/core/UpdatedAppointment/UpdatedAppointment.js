'use strict';

const { pollAppointments, findTestAppointment } = require('../../lib');

module.exports = {

    async tick(context) {

        return pollAppointments(context, 'updated');
    },

    async test(context) {

        // Flow Test Mode: no polling state, emit any existing appointment of the patient.
        const appointment = await findTestAppointment(context);
        if (!appointment) {
            throw new Error('No appointments found for the patient to use as test data.');
        }
        return context.sendJson(appointment, 'out');
    }
};
