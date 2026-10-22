'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        if (!input.recordId) {
            throw new context.CancelError('Record ID is required!');
        }

        const values = lib.buildPersonValues(context, input);
        if (Object.keys(values).length === 0) {
            throw new context.CancelError('Provide at least one value to update.');
        }

        // The name is written as a whole: keep the current first or last name when only one is given.
        if (values.name && (!input.firstName || !input.lastName)) {
            const record = await lib.getRecord(context, 'people', input.recordId);
            const current = ((record.rawValues.name || []).find(v => !v.active_until)) || {};
            const firstName = input.firstName || current.first_name || '';
            const lastName = input.lastName || current.last_name || '';
            values.name = {
                first_name: firstName,
                last_name: lastName,
                full_name: [firstName, lastName].filter(Boolean).join(' ')
            };
        }

        // PATCH appends values of multiselect attributes (email addresses, phone numbers), PUT replaces them.
        await lib.apiRequest(context, {
            method: input.overwriteMultiselect ? 'PUT' : 'PATCH',
            path: '/v2/objects/people/records/' + encodeURIComponent(input.recordId),
            data: { data: { values } }
        });

        return context.sendJson({}, 'out');
    }
};
