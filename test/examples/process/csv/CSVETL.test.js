const path = require('path');
const fs = require('fs');
const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../utils.js');
const { receive } = require('../../../../src/examples/process/csv/CSVETL/CSVETL.js');

describe('CSVETL', async () => {

    let context = testUtils.createMockContext();

    before(async () => {

        // Ensure the test file exists. Also needed for `ProcessLargeCSV1.test.js`.
        const testFilePath = path.join(__dirname, '../../../../src/examples/process/csv/large_csv_12000.csv');
        if (!fs.existsSync(testFilePath)) {
            // run the script to generate the test file
            const generateFileScript = path.join(__dirname, '../../../../src/examples/process/csv/_create_large_csv.sh');
            const { execSync } = require('child_process');
            try {
                // cd to the directory where the script is located
                process.chdir(path.dirname(generateFileScript));
                execSync(`bash ${generateFileScript}`, { stdio: 'inherit' });
                console.log('Test file generated successfully:', testFilePath);
            } catch (error) {
                console.error('Error generating test file:', error);
                throw new Error('Test file generation failed');
            }
        }
    });

    beforeEach(async () => {

        // Reset the context.
        context = {
            ...testUtils.createMockContext(),
            getFileInfo: sinon.stub().returns({
                fileId: '83d460fa-93d2-4392-8819-edb1e4865ffb',
                filename: 'large_csv_12000.csv',
                contentType: 'text/csv',
                length: 123456
            }),
            lock: sinon.stub().returns({ unlock: sinon.stub() })
        };
    });

    it('processes 12k line file', async function() {

        const FILENAME = 'large_csv_12000';
        const NEW_FILE_ID = 'new-file-id';
        const NEW_FILEPATH = `../../../../src/examples/process/csv/${FILENAME}-processed.csv`;
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
        const pathToCSV = path.join(__dirname, `../../../../src/examples/process/csv/${FILENAME}.csv`);
        context.getFileReadStream = () => fs.createReadStream(pathToCSV, {
            encoding: null,
            // Set to 255 KB to simulate the default value of `chunkSizeBytes` in `GridFSBucketReadStream`.
            highWaterMark: 255 * 1024
        });

        // 1.2 million rows takes about 20 seconds on MacBook Pro M1.
        this.timeout(30000);

        const content = {
            fileId: '83d460fa-93d2-4392-8819-edb1e4865ffb',
            filename: 'large_csv_12000-processed.csv',
            transformation: {
                // DTL expression for the required logic:
                // Accepts array [A,B,C] and outputs as per rules
                // Does not handle headers, so the first row is processed as data.
                out: `(:
                    ?((!empty($.[0]) && empty($.[1])) ($.[0] + ',' + $.[2] + '\n') (
                        ?((empty($.[0]) && !empty($.[1])) ($.[1] + ',' + $.[2] + '\n') (
                            ?((!empty($.[0]) && !empty($.[1])) ($.[0] + ',' + $.[2] + '\n' + $.[1] + ',' + $.[2] + '\n'))
                        ))
                    ))
                :)`
            }
        };
        context.messages = { in: { content } };

        await receive(context);

        const sendJsonArgs = context.sendJson.getCall(0).args;
        assert.strictEqual(sendJsonArgs[0].fileId, NEW_FILE_ID);
        assert.strictEqual(sendJsonArgs[0].filename, content.filename);
        // Read the actual file to check the row count
        const processedFilePath = path.join(__dirname, NEW_FILEPATH);
        const processedFileContent = fs.readFileSync(processedFilePath, 'utf8');
        const processedRows = processedFileContent.split('\n').filter(row => row.trim() !== '');
        assert(processedRows.length > 12000, 'Processed file should have 12000 rows but has ' + processedRows.length);
    });
});
