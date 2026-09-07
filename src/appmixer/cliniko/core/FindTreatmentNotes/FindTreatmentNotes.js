'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Treatment Note ID' },
    patient_id: { type: 'string', title: 'Patient ID' },
    practitioner_id: { type: 'string', title: 'Practitioner ID' },
    booking_id: { type: 'string', title: 'Booking ID' },
    treatment_note_template_id: { type: 'string', title: 'Treatment Note Template ID' },
    title: { type: 'string', title: 'Title' },
    author_name: { type: 'string', title: 'Author Name' },
    draft: { type: 'boolean', title: 'Draft' },
    content: { type: 'object', title: 'Content' },
    finalized_at: { type: 'string', format: 'date-time', title: 'Finalized At' },
    pinned_at: { type: 'string', format: 'date-time', title: 'Pinned At' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

const RELATIONS = ['patient', 'practitioner', 'booking', 'treatment_note_template'];

/**
 * Turn the inspector inputs into Cliniko `q[]` filters.
 * @param {object} content
 * @returns {Array<string>}
 */
function buildFilters(content) {

    const { patientId, practitionerId, draft, createdAtFrom, updatedAtFrom } = content;

    const filters = [];

    if (patientId) filters.push(`patient_id:=${patientId}`);
    if (practitionerId) filters.push(`practitioner_id:=${practitionerId}`);
    if (draft) filters.push(`draft:=${draft}`);
    if (createdAtFrom) filters.push(`created_at:>=${createdAtFrom}`);
    if (updatedAtFrom) filters.push(`updated_at:>=${updatedAtFrom}`);

    return filters;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array' } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Treatment Notes' });
        }

        const records = (await lib.fetchPage(context, {
            path: '/treatment_notes',
            collection: 'treatment_notes',
            filters: buildFilters(content),
            params: { sort: 'updated_at:desc' }
        })).map((record) => lib.expandIds(record, RELATIONS));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
