const path = require('path');
const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const { receive } = require('../../../src/appmixer/utils/csv/GetRows/GetRows.js');

const pathToCSV = path.join(__dirname, 'ID,Email,Name-3.csv');

describe('GetRows', async () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = {
            ...testUtils.createMockContext(),
            getFileReadStream: sinon.stub().returns(() => fs.createReadStream(pathToCSV)),
            lock: sinon.stub().returns({ unlock: sinon.stub() })
        };
    });

    it('should get a row from a CSV file', async function() {

        const content = {
            allAtOnce: true,
            parseNumbers: false,
            parseBooleans: true,
            rowFormat: 'object',
            fileId: '83d460fa-93d2-4392-8819-edb1e4865ffa',
            filters: {
                OR: [{
                    AND: [{
                        value: '^\\d$',
                        operator: 'regex',
                        column: 'ID'
                    }]
                }]
            },
            delimiter: ','
        };
        context.properties = {
            withHeaders: true,
            filterRows: true
        };
        context.messages = { in: { content } };

        await receive(context);

        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.strictEqual(sendJsonArgs[0].rows.length, 3, 'Should have three rows');
        const rowActual = sendJsonArgs[0].rows[2];
        // Fifth row in the CSV file.
        const rowExpected = fs.readFileSync(pathToCSV, 'utf8').split('\n')[3].split(',');
        assert.equal(rowActual.ID, rowExpected[0].trim());
        assert.equal(rowActual.Email, rowExpected[1].trim());
    });

    it('no Maximum call stack exceeded', async function() {

        this.timeout(5000);
        /** File with short rows and small cells. 8000 rows. */
        const pathToCSV = path.join(__dirname, 'ID,Email,Email,Email,Email,Email,Email-8000.csv');
        context.getFileReadStream = () => fs.createReadStream(pathToCSV, {
            encoding: null,
            // Set to 255 KB to simulate the default value of `chunkSizeBytes` in `GridFSBucketReadStream`.
            highWaterMark: 255 * 1024
        });

        const content = {
            allAtOnce: true,
            parseNumbers: false,
            parseBooleans: true,
            rowFormat: 'object',
            fileId: '83d460fa-93d2-4392-8819-edb1e4865ffa',
            filters: {
                OR: [{
                    AND: [{
                        value: '^\\d$',
                        operator: 'regex',
                        column: 'ID'
                    }]
                }]
            },
            delimiter: ','
        };
        context.properties = {
            withHeaders: true,
            filterRows: true
        };
        context.messages = { in: { content } };

        await receive(context);

        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.strictEqual(sendJsonArgs[0].rows.length, 9, 'Should have nine rows with single digit IDs');
        const rowActual = sendJsonArgs[0].rows[3];
        // Fifth row in the CSV file.
        const rowExpected = fs.readFileSync(pathToCSV, 'utf8').split('\n')[4].split(',');
        assert.equal(rowActual.ID, rowExpected[0].trim());
        assert.equal(rowActual.Email, rowExpected[1].trim());
    });

});
