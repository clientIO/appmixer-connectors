'use strict';
const commons = require('../lib');

const OBJECT_NAME = 'Contact';
const OUTPUT_PORT = 'contact';

/**
 * Trigger that fires with the contact details whenever the monitored status
 * field changes value on a specific Contact (when Contact ID is set) or on any
 * Contact.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const { fieldName, contactId } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        await commons.runFieldChangeStart(context, {
            objectName: OBJECT_NAME,
            fieldName,
            recordId: contactId
        });
    },

    async tick(context) {

        const { fieldName, contactId } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        await commons.runFieldChangeTick(context, {
            objectName: OBJECT_NAME,
            fieldName,
            recordId: contactId,
            outputPortName: OUTPUT_PORT
        });
    },

    async test(context) {

        const { fieldName, contactId } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        const record = await commons.getLatestRecord(context, {
            objectName: OBJECT_NAME,
            recordId: contactId
        });
        if (!record) {
            throw new Error('No Contact record available to use as test data.');
        }
        return context.sendJson(commons.formatSalesforceDates(record), OUTPUT_PORT);
    }
};
