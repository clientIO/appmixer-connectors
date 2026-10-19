'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Invoice ID' },
    number: { type: 'integer', title: 'Invoice Number' },
    patient_id: { type: 'string', title: 'Patient ID' },
    practitioner_id: { type: 'string', title: 'Practitioner ID' },
    business_id: { type: 'string', title: 'Business ID' },
    appointment_id: { type: 'string', title: 'Appointment ID' },
    invoice_to: { type: 'string', title: 'Invoice To' },
    issue_date: { type: 'string', format: 'date', title: 'Issue Date' },
    status: { type: 'integer', title: 'Status' },
    status_description: { type: 'string', title: 'Status Description' },
    net_amount: { type: 'string', title: 'Net Amount' },
    tax_amount: { type: 'string', title: 'Tax Amount' },
    discounted_amount: { type: 'string', title: 'Discounted Amount' },
    total_amount: { type: 'string', title: 'Total Amount' },
    notes: { type: 'string', title: 'Notes' },
    online_payment_url: { type: 'string', title: 'Online Payment URL' },
    closed_at: { type: 'string', format: 'date-time', title: 'Closed At' },
    archived_at: { type: 'string', format: 'date-time', title: 'Archived At' },
    created_at: { type: 'string', format: 'date-time', title: 'Created At' },
    updated_at: { type: 'string', format: 'date-time', title: 'Updated At' }
};

const RELATIONS = ['patient', 'practitioner', 'business', 'appointment'];

/**
 * Turn the inspector inputs into Cliniko `q[]` filters.
 * @param {object} content
 * @returns {Array<string>}
 */
function buildFilters(content) {

    const { patientId, practitionerId, businessId, status, issueDateFrom, issueDateTo, createdAtFrom } = content;

    const filters = [];

    if (patientId) filters.push(`patient_id:=${patientId}`);
    if (practitionerId) filters.push(`practitioner_id:=${practitionerId}`);
    if (businessId) filters.push(`business_id:=${businessId}`);
    // `status` is numeric, so an explicit null/'' check keeps a legitimate 0 usable.
    if (status !== undefined && status !== null && status !== '') filters.push(`status:=${status}`);
    if (issueDateFrom) filters.push(`issue_date:>=${issueDateFrom}`);
    if (issueDateTo) filters.push(`issue_date:<=${issueDateTo}`);
    if (createdAtFrom) filters.push(`created_at:>=${createdAtFrom}`);

    return filters;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content || {};
        const { outputType = 'array' } = content;

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Invoices' });
        }

        const records = (await lib.fetchPage(context, {
            path: '/invoices',
            collection: 'invoices',
            filters: buildFilters(content),
            params: { sort: 'issue_date:desc' }
        })).map((record) => lib.expandIds(record, RELATIONS));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
