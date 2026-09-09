'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { google } = require('googleapis');
const component = require('../../DeleteFileOrFolder/DeleteFileOrFolder');

describe('google.drive DeleteFileOrFolder', () => {

    let sandbox;
    let deleteStub;
    let context;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        deleteStub = sandbox.stub().resolves({});
        sandbox.stub(google, 'drive').returns({ files: { delete: deleteStub } });
        context = {
            auth: { accessToken: 'test-token', clientId: 'test-id', clientSecret: 'test-secret' },
            messages: { in: { content: {} } },
            sendJson: sandbox.stub().resolves(),
            CancelError: class CancelError extends Error {}
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should emit the declared googleDriveFileId and the historical fileId', async () => {

        context.messages.in.content = { fileId: 'abc123' };

        await component.receive(context);

        assert.deepStrictEqual(deleteStub.firstCall.args[0], { fileId: 'abc123' });
        assert.deepStrictEqual(context.sendJson.firstCall.args, [{ googleDriveFileId: 'abc123', fileId: 'abc123' }, 'out']);
    });

    it('should accept the Google Picker object shape', async () => {

        context.messages.in.content = { fileId: { id: 'picked', name: 'x.txt' } };

        await component.receive(context);

        assert.deepStrictEqual(deleteStub.firstCall.args[0], { fileId: 'picked' });
    });

    it('should reject a missing file ID before calling the API', async () => {

        await assert.rejects(() => component.receive(context), context.CancelError);
        assert.strictEqual(deleteStub.callCount, 0);
    });
});
