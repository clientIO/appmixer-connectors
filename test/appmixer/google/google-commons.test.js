const assert = require('assert');
const { isNewInboxEmail, sendArrayOutput } = require('../../../src/appmixer/google/google-commons');

const contextMock = function() {
    return {
        componentId: 'mock',
        flowDescriptor: { 'mock': { label: 'label' } },
        config: {},
        // log: console.log,
        log: () => {
            //noop
        },
        saveFileStream: function(filename, buffer) {
            return { fileId: 'fileId' };
        },
        sendJson: () => {
            //noop
        }
    };
};

describe('google-commons', function() {
    describe('isNewInboxEmail', function() {
        it('should throw', function() {
            // assert.equal(isNewInboxEmail(), false);
            assert.throws(() => isNewInboxEmail(), Error);
        });
        it('should return false for SENT', function() {
            assert.equal(isNewInboxEmail(['SENT']), false);
        });
    });

    describe('sendArrayOutput', async function() {

        it('file - check output csv with nested object', async function() {

            const context = contextMock();

            context.saveFileStream = (filename, buffer) => {
                const csvString = buffer.toString();
                assert.equal(csvString, [
                    'a,nested',
                    '"A","{""x"":""X"",""y"":""Y""}"'
                ].join('\n'));

                return { fileId: 'fileId' };
            };

            const records = [{ a: 'A', nested: { x: 'X', y: 'Y' } }];
            await sendArrayOutput({ context, records: records, outputType: 'file' });
        });
    });
});
