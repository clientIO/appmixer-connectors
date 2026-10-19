'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { patientId, name } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient is required!');
        }
        if (!name) {
            throw new context.CancelError('Alert is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/medical_alerts',
            headers: { 'Content-Type': 'application/json' },
            data: { patient_id: patientId, name }
        });

        return context.sendJson(lib.expandIds(data, ['patient']), 'out');
    }
};
