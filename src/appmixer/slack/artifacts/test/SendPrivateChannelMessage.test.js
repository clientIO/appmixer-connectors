const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../test/utils.js');

const lib = require('../../lib.js');
const SendPrivateChannelMessage = require('../../list/SendPrivateChannelMessage/SendPrivateChannelMessage.js');

describe('SendPrivateChannelMessage component (options focus)', () => {

    let context;
    let sendMessageStub;

    beforeEach(() => {
        context = testUtils.createMockContext();
        context.messages = {
            message: {
                content: {
                    channelId: 'G123',
                    text: 'Hello private world',
                    asBot: true,
                    threadTs: '1717171717.000200',
                    replyBroadcast: true,
                    username: 'MySlackBot',
                    iconUrl: 'https://example.com/icon.png'
                }
            }
        };

        sendMessageStub = sinon.stub(lib, 'sendMessage').resolves({ text: 'ok' });
    });

    afterEach(() => {
        if (sendMessageStub) sendMessageStub.restore();
    });

    it('passes username and iconUrl in options when provided', async () => {
        await SendPrivateChannelMessage.receive(context);

        assert.equal(sendMessageStub.callCount, 1);
        const args = sendMessageStub.getCall(0).args;
        assert.deepStrictEqual(args[6], { username: 'MySlackBot', iconUrl: 'https://example.com/icon.png' });
    });

    it('uses empty options when neither username nor iconUrl is provided', async () => {
        context.messages.message.content.username = undefined;
        context.messages.message.content.iconUrl = undefined;

        await SendPrivateChannelMessage.receive(context);

        assert.equal(sendMessageStub.callCount, 1);
        const args = sendMessageStub.getCall(0).args;
        assert.deepStrictEqual(args[6], {});
    });
});
