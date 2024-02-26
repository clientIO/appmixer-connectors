const assert = require('assert');
const sinon = require('sinon');

const action = require('../../../../../src/appmixer/openai/core/createSpeech/createSpeech');

describe('createSpeech', function() {

    const context = {
        auth: { apiKey: 'apiKey' },
        componentId: 'mock',
        componentType: 'appmixer.openai.core.createSpeech',
        flowDescriptor: { 'mock': { label: 'label' } },
        profileInfo: { companyId: 'companyId' },
        config: {},
        log: console.log,
        httpRequest: sinon.stub(),
        saveFileStream: sinon.stub(),
        sendJson: sinon.stub(),
        messages: { in: { content: {} } },
        CancelError: Error
    };

    describe('receive', async function() {

        beforeEach(function() {

            sinon.reset();
            context.httpRequest.resolves({ data: 'data' });
        });

        it('default filename', async function() {

            await action.receive(context);
            const saveFileStreamCall = context.saveFileStream.getCall(0);
            assert.match(saveFileStreamCall.args[0], /\d+_openai_createSpeech/, 'should have a default filename');
            assert.strictEqual(saveFileStreamCall.args[1], 'data');
            const sendJsonCallCount = context.sendJson.callCount;
            assert.strictEqual(sendJsonCallCount, 1);
        });
    });
});
