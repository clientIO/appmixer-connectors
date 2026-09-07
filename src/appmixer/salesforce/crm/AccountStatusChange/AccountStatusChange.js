'use strict';
const commons = require('../lib');

const OBJECT_NAME = 'Account';
const OUTPUT_PORT = 'account';

/**
 * Trigger that fires with the account details whenever the monitored status
 * field changes value on an Account.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const { fieldName } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        await commons.runFieldChangeStart(context, { objectName: OBJECT_NAME, fieldName });
    },

    async tick(context) {

        const { fieldName } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        await commons.runFieldChangeTick(context, {
            objectName: OBJECT_NAME,
            fieldName,
            outputPortName: OUTPUT_PORT
        });
    },

    async test(context) {

        const { fieldName } = context.properties;
        if (!fieldName) {
            throw new context.CancelError('Status Field is required!');
        }
        const record = await commons.getLatestRecord(context, { objectName: OBJECT_NAME });
        if (!record) {
            throw new Error('No Account record available to use as test data.');
        }
        return context.sendJson(commons.formatSalesforceDates(record), OUTPUT_PORT);
    }
};
