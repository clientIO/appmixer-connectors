'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Contact ID' },
    first_name: { type: 'string', title: 'First Name' },
    last_name: { type: 'string', title: 'Last Name' },
    preferred_name: { type: 'string', title: 'Preferred Name' },
    company_name: { type: 'string', title: 'Company Name' },
    email: { type: 'string', title: 'Email' },
    type: { type: 'string', title: 'Type' },
    type_code: { type: 'integer', title: 'Type Code' },
    doctor_type: { type: 'string', title: 'Doctor Type' },
    provider_number: { type: 'string', title: 'Provider Number' },
    occupation: { type: 'string', title: 'Occupation' },
    title: { type: 'string', title: 'Title' },
    address_1: { type: 'string', title: 'Address Line 1' },
    address_2: { type: 'string', title: 'Address Line 2' },
    address_3: { type: 'string', title: 'Address Line 3' },
    city: { type: 'string', title: 'City' },
    state: { type: 'string', title: 'State' },
    post_code: { type: 'string', title: 'Post Code' },
    country: { type: 'string', title: 'Country' },
    country_code: { type: 'string', title: 'Country Code' },
    notes: { type: 'string', title: 'Notes' },
    phone_numbers: { type: 'array', title: 'Phone Numbers' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

const RELATIONS = [];

/**
 * Turn the inspector inputs into Cliniko `q[]` filters.
 * @param {object} content
 * @returns {Array<string>}
 */
function buildFilters(content) {

    const { firstName, lastName, companyName, email, createdAtFrom, updatedAtFrom } = content;

    const filters = [];

    if (firstName) filters.push(`first_name:~${firstName}`);
    if (lastName) filters.push(`last_name:~${lastName}`);
    if (companyName) filters.push(`company_name:~${companyName}`);
    if (email) filters.push(`email:~${email}`);
    if (createdAtFrom) filters.push(`created_at:>=${createdAtFrom}`);
    if (updatedAtFrom) filters.push(`updated_at:>=${updatedAtFrom}`);

    return filters;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array' } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts' });
        }

        const records = (await lib.fetchPage(context, {
            path: '/contacts',
            collection: 'contacts',
            filters: buildFilters(content),
            params: { sort: 'updated_at:desc' }
        })).map((record) => lib.expandIds(record, RELATIONS));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
