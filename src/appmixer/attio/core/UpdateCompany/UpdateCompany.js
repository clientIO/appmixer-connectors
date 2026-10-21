'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        if (!input.recordId) {
            throw new context.CancelError('Record ID is required!');
        }

        const values = lib.buildCompanyValues(context, input);
        if (Object.keys(values).length === 0) {
            throw new context.CancelError('Provide at least one value to update.');
        }

        // PATCH appends values of multiselect attributes (domains), PUT replaces them.
        await lib.apiRequest(context, {
            method: input.overwriteMultiselect ? 'PUT' : 'PATCH',
            path: '/v2/objects/companies/records/' + encodeURIComponent(input.recordId),
            data: { data: { values } }
        });

        return context.sendJson({}, 'out');
    }
};
