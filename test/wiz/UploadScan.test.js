const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const uploadScan = require('../../src/appmixer/wiz/core/UploadScan/UploadScan.js');
const moment = require('moment');

describe('wiz.uploadScan', () => {

    let context;

    beforeEach(async () => {
        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            setTimeout: sinon.spy()
        };

    });

    it('schedule drain 1 minute from now', async () => {
        const scheduleValue = 1;

        context.properties = {
            scheduleType: 'minutes',
            scheduleValue
        };

        uploadScan.scheduleDrain(context, { previousDate: null });
        const diff = context.setTimeout.getCall(0).args[1];
        const expectedSeconds = scheduleValue * 60;
        assert.equal(Math.round(diff / 1000), expectedSeconds, 'Timeout should be set to the schedule value in milliseconds');
    });

    it('schedule drain 1 minute from now', async () => {
        const scheduleValue = 1;

        context.properties = {
            scheduleType: 'hours',
            scheduleValue
        };

        uploadScan.scheduleDrain(context, { previousDate: null });
        const diff = context.setTimeout.getCall(0).args[1];
        const expectedSeconds = scheduleValue * 60 * 60;
        assert.equal(Math.round(diff / 1000), expectedSeconds, 'Timeout should be set to the schedule value in milliseconds');
    });

    it('schedule drain 1 day from now', async () => {
        const scheduleValue = 1;

        context.properties = {
            scheduleType: 'days',
            scheduleValue
        };

        uploadScan.scheduleDrain(context, { previousDate: null });
        const diff = context.setTimeout.getCall(0).args[1];
        const expectedSeconds = scheduleValue * 60 * 60 * 24;
        assert.equal(Math.round(diff / 1000), expectedSeconds, 'Timeout should be set to the schedule value in milliseconds');
    });
});
