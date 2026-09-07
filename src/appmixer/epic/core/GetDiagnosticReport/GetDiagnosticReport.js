'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { diagnosticReportId } = context.messages.in.content;

        if (!diagnosticReportId) {
            throw new context.CancelError('Diagnostic Report ID is required!');
        }

        const report = await fhirRequest(context, { resource: `DiagnosticReport/${diagnosticReportId}` });

        return context.sendJson(report, 'out');
    }
};
