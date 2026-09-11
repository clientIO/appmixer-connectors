'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

// The out port is dynamic (outputType), so the item contract is exported for the offline tooling
// (`appmixer connector verify`, outport-nested-title-prefix).
const ITEM_SCHEMA = {
    type: 'object',
    properties: lib.schemas.appointment,
    required: ['id']
};

/**
 * Find appointments matching the given criteria.
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { appointmentName, status, startTimeFrom, startTimeTo, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
                label: 'Appointments',
                value: 'result'
            });
        }

        // The Appointments module is only exposed from API v5 up, hence the version override.
        const client = new ZohoClient(context, undefined, { apiVersion: lib.APPOINTMENTS_API_VERSION });
        // `fields` is mandatory when reading a module from API v3 up.
        const fields = lib.APPOINTMENT_FIELDS.join(',');
        const criteria = lib.buildCriteria([
            appointmentName ? `(Appointment_Name:starts_with:${lib.escapeCriteriaValue(appointmentName)})` : null,
            status ? `(Status:equals:${lib.escapeCriteriaValue(status)})` : null,
            startTimeFrom ? `(Appointment_Start_Time:greater_equal:${lib.formatDateTime(startTimeFrom)})` : null,
            startTimeTo ? `(Appointment_Start_Time:less_equal:${lib.formatDateTime(startTimeTo)})` : null
        ]);

        const records = criteria
            ? await client.search(lib.APPOINTMENTS_MODULE, { criteria, fields })
            : await client.getRecords(lib.APPOINTMENTS_MODULE, { params: { fields } });

        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
