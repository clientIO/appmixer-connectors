const path = require('path');
const fs = require('fs');
const sinon = require('sinon');
const assert = require('assert');
const testUtils = require('../../utils.js');
const AddRow = require('../../../src/appmixer/utils/csv/AddRow/AddRow');

const pathToCSV = path.join(__dirname, 'ID,Email,Name-3.csv');

describe('AddRow', () => {

    let context;

    beforeEach(() => {

        context = {
            ...testUtils.createMockContext(),
            getFileReadStream: () => fs.createReadStream(pathToCSV),
            replaceFileStream: sinon.stub().resolves({ fileId: 'file-1', filename: 'test.csv' }),
            properties: { withHeaders: false },
            messages: {
                in: {
                    content: {
                        fileId: 'file-1',
                        delimiter: ',',
                        row: 'a,b,c'
                    }
                }
            },
            config: {}
        };
    });

    it('should call processor.addRows with string row', async () => {

        await AddRow.receive(context);

        assert(context.replaceFileStream.calledOnce, 'replaceFileStream should be called once');
        const callArgs = context.replaceFileStream.getCall(0).args;
        assert.strictEqual(callArgs[0], 'file-1', 'File ID should be file-1');
    });

    it('should call processor.addRows with array', async () => {

        // Not the recommended way, but can be achieved by using eg.: SetVariable->Each->AddRow.
        context.messages.in.content.row = ['a', 'b', 'c'];
        await AddRow.receive(context);

        assert(context.replaceFileStream.calledOnce, 'replaceFileStream should be called once');
        const callArgs = context.replaceFileStream.getCall(0).args;
        assert.strictEqual(callArgs[0], 'file-1', 'File ID should be file-1');
    });
});
