'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { patientId } = context.messages.in.content;

        if (!patientId) {
            throw new context.CancelError('Patient is required!');
        }

        await lib.apiRequest(context, {
            method: 'POST',
            path: `/patients/${encodeURIComponent(patientId)}/archive`
        });

        return context.sendJson({}, 'out');
    }
};
