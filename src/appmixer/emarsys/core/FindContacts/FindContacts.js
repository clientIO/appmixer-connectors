'use strict';

const lib = require('../../lib');

// The `out` port is dynamic — the real option list is built per account from /field, because most
// of a contact's data lives in fields the customer defined. This is the floor of that contract:
// the keys every Emarsys account has. Only `id` is in `required`; the rest are absent whenever the
// user narrows "Fields to Return" or the account renamed a system field.
// Declared above module.exports so requiring the file cannot hit a TDZ error.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', title: 'Contact ID', example: '2451' },
        uid: { type: 'string', title: 'Contact UID', example: 'CMLOReArrR' },
        first_name: { type: 'string', title: 'First Name', example: 'Jane' },
        last_name: { type: 'string', title: 'Last Name', example: 'Doe' },
        email: { type: 'string', title: 'Email', example: 'jane.doe@example.com' },
        opt_in: { type: 'string', title: 'Opt-in', example: '1' }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { filterField, filterValue, fields, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties.generateOutputPortOptions) {
            let properties = ITEM_SCHEMA.properties;
            try {
                properties = await lib.contactSchemaProperties(context, ITEM_SCHEMA.properties, fields);
            } catch (err) {
                // No account bound yet, or the credential lacks the field.list permission. Offer
                // the keys every account has rather than an empty variable picker.
                await context.log({ step: 'Could not load contact fields for output port options', message: err.message });
            }
            return lib.getOutputPortOptions(context, outputType, properties, { label: 'Contacts', value: 'result' });
        }

        if (!filterField) {
            throw new context.CancelError('Filter Field is required!');
        }
        if (filterValue === undefined || filterValue === null || filterValue === '') {
            throw new context.CancelError('Filter Value is required!');
        }

        const allFields = await lib.getFields(context);

        // Two calls on purpose: query by the chosen field to collect ids, then read by id. Reading
        // by email directly fails with error 2010 as soon as an account holds duplicate emails,
        // and query alone only ever returns the one field asked for in `return`.
        const ids = await lib.queryContactIds(context, { fieldId: filterField, value: filterValue });
        if (!ids.length) {
            return context.sendJson({}, 'notFound');
        }

        const records = await lib.getContactsByIds(context, {
            ids,
            fieldIds: lib.normalizeSelectedFields(fields, allFields),
            fieldsById: lib.indexFieldsById(allFields)
        });
        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
