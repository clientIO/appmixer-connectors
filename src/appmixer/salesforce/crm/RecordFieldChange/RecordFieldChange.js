'use strict';
const commons = require('../lib');

const OUTPUT_PORT = 'record';

/**
 * Generic trigger that fires whenever a chosen field changes value on any
 * record of the selected object (standard or custom).
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const { objectName, fieldName } = context.properties;
        if (!objectName) {
            throw new context.CancelError('Object Name is required!');
        }
        if (!fieldName) {
            throw new context.CancelError('Field Name is required!');
        }
        await commons.runFieldChangeStart(context, { objectName, fieldName });
    },

    async tick(context) {

        const { objectName, fieldName } = context.properties;
        if (!objectName) {
            throw new context.CancelError('Object Name is required!');
        }
        if (!fieldName) {
            throw new context.CancelError('Field Name is required!');
        }
        await commons.runFieldChangeTick(context, {
            objectName,
            fieldName,
            outputPortName: OUTPUT_PORT
        });
    },

    async test(context) {

        const { objectName, fieldName } = context.properties;
        if (!objectName) {
            throw new context.CancelError('Object Name is required!');
        }
        if (!fieldName) {
            throw new context.CancelError('Field Name is required!');
        }
        const record = await commons.getLatestRecord(context, { objectName });
        if (!record) {
            throw new Error(`No ${objectName} record available to use as test data.`);
        }
        return context.sendJson(commons.formatSalesforceDates(record), OUTPUT_PORT);
    }
};
