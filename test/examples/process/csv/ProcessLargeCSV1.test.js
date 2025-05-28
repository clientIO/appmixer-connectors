const path = require('path');
const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../utils.js');
const { receive } = require('../../../../src/examples/process/csv/ProcessLargeCSV1/ProcessLargeCSV1.js');

const pathToCSV = path.join(__dirname, 'ID,Email,Name-3.csv');

describe('ProcessLargeCSV1', async () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = {
            ...testUtils.createMockContext(),
            getFileReadStream: sinon.stub().returns(() => fs.createReadStream(pathToCSV)),
            getFileInfo: sinon.stub().returns({
                fileId: '83d460fa-93d2-4392-8819-edb1e4865ffc',
                filename: 'large_csv_12000.csv',
                contentType: 'text/csv',
                length: 123456
            }),
            lock: sinon.stub().returns({ unlock: sinon.stub() })
        };
    });

    it('processes 12k line file', async function() {

        const NEW_FILE_ID = 'new-file-id';
        const NEW_FILEPATH = '../../../../src/examples/process/csv/large_csv_12000-processed.csv';
        // Mock saving the file.
        context.saveFileStream = sinon.stub().callsFake((filename, csvStream) => {
            // Write the stream to a file for testing purposes
            const filePath = path.join(__dirname, NEW_FILEPATH);
            const writeStream = fs.createWriteStream(filePath);
            csvStream.on('data', (chunk) => {
                writeStream.write(chunk);
            });
            csvStream.on('end', () => {
                writeStream.end();
            });
            csvStream.on('error', (err) => {
                console.error('Error in stream:', err);
                writeStream.destroy(err);
            });
            // Return a promise that resolves when the write stream finishes
            // This simulates the behavior of saving a file in a real application
            writeStream.on('error', (err) => {
                console.error('Error writing file:', err);
                throw err;
            });
            // Simulate a file save operation
            console.log('Simulating file save operation for:', filename);

            return new Promise((resolve, reject) => {
                writeStream.on('finish', () => {
                    console.log('File saved:', filePath);
                    resolve({
                        fileId: NEW_FILE_ID,
                        filename,
                        contentType: 'text/csv',
                        length: 123456
                    });
                });
                writeStream.on('error', (err) => {
                    console.error('Error saving file:', err);
                    reject(err);
                });
            });
        });

        /** File with short rows and small cells. 12k rows. */
        const pathToCSV = path.join(__dirname, '../../../../src/examples/process/csv/large_csv_12000.csv');
        context.getFileReadStream = () => fs.createReadStream(pathToCSV, {
            encoding: null,
            // Set to 255 KB to simulate the default value of `chunkSizeBytes` in `GridFSBucketReadStream`.
            highWaterMark: 255 * 1024
        });

        // 12k rows usually takes about 100ms.
        this.timeout(5000);

        const content = {
            fileId: '83d460fa-93d2-4392-8819-edb1e4865ffc',
            filename: 'large_csv_12000-processed.csv'
        };
        context.messages = { in: { content } };

        await receive(context);

        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.strictEqual(sendJsonArgs[0].fileId, NEW_FILE_ID);
        assert.strictEqual(sendJsonArgs[0].filename, content.filename);
        assert(sendJsonArgs[0].rowCount > 12000, 'Row count should be greater than 12000 but is ' + sendJsonArgs[0].rowCount);
    });
});
