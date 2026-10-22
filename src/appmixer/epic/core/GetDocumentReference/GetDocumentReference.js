'use strict';

const { fhirRequest } = require('../../lib');

module.exports = {
    async receive(context) {

        const { documentReferenceId } = context.messages.in.content;

        if (!documentReferenceId) {
            throw new context.CancelError('Document Reference ID is required!');
        }

        const document = await fhirRequest(context, { resource: `DocumentReference/${documentReferenceId}` });

        return context.sendJson(document, 'out');
    }
};
