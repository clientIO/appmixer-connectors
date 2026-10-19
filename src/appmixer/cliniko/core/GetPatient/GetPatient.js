'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { patientId } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/patients/${encodeURIComponent(patientId)}`
        });

        return context.sendJson(data, 'out');
    }
};
