const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../test/utils.js');

const lib = require('../../lib.js');
const SendChannelMessage = require('../../list/SendChannelMessage/SendChannelMessage.js');

describe('SendChannelMessage component', () => {

    let context;
    let sendMessageStub;

    beforeEach(() => {
        context = testUtils.createMockContext();
        context.messages = {
            message: {
                content: {
                    channelId: 'C123',
                    text: 'Hello world',
                    asBot: true,
                    threadTs: '1717171717.000100',
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

    it('calls sendMessage with options including username and iconUrl when provided', async () => {
        await SendChannelMessage.receive(context);

        assert.equal(sendMessageStub.callCount, 1);
        const args = sendMessageStub.getCall(0).args;

        assert.strictEqual(args[0], context);
        assert.strictEqual(args[1], 'C123');
        assert.strictEqual(args[2], 'Hello world');
        assert.strictEqual(args[3], true);
        assert.strictEqual(args[4], '1717171717.000100');
        assert.strictEqual(args[5], true);
        assert.deepStrictEqual(args[6], { username: 'MySlackBot', iconUrl: 'https://example.com/icon.png' });
    });

    it('still honours the pre-5.5.1 thread_ts / reply_broadcast input names', async () => {
        delete context.messages.message.content.threadTs;
        delete context.messages.message.content.replyBroadcast;
        context.messages.message.content.thread_ts = '1717171717.000300';
        context.messages.message.content.reply_broadcast = true;

        await SendChannelMessage.receive(context);

        const args = sendMessageStub.getCall(0).args;
        assert.strictEqual(args[4], '1717171717.000300');
        assert.strictEqual(args[5], true);
    });

    it('rejects a missing channel with CancelError', async () => {
        context.messages.message.content.channelId = undefined;

        await assert.rejects(() => SendChannelMessage.receive(context), context.CancelError);
        assert.equal(sendMessageStub.callCount, 0);
    });

    it('calls sendMessage with empty options when username and iconUrl are not provided', async () => {
        context.messages.message.content.username = undefined;
        context.messages.message.content.iconUrl = undefined;

        await SendChannelMessage.receive(context);

        assert.equal(sendMessageStub.callCount, 1);
        const args = sendMessageStub.getCall(0).args;
        assert.deepStrictEqual(args[6], {});
    });
});
