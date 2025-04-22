const assert = require('assert');
const testUtils = require('../utils.js');
const NewChannelMessageRT = require('../../src/appmixer/slack/list/NewChannelMessageRT/NewChannelMessageRT.js');

describe('NewChannelMessageRT', () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Set the profile info.
        context.auth = {
            accessToken: 'slack_access_token'
        };
        context.config = {
            // App token for message access authorization.
            authToken: 'one-long-verification-token',
            signingSecret: 'signing_secret'
        };
        // Set the properties.
        context.properties = {
            channelId: 'slack_channel_id'
        };
        context.messages = { webhook: { content: { data: null } } };
    });

    it('start', async () => {

        await NewChannelMessageRT.start(context);

        // Assert the listener was added.
        assert.equal(context.addListener.callCount, 1);
        const addListenerCall = context.addListener.getCall(0);
        assert.equal(addListenerCall.args[0], context.properties.channelId);
    });

    it('stop', async () => {

        await NewChannelMessageRT.stop(context);

        // Assert the listener was removed.
        assert.equal(context.removeListener.callCount, 1);
        const removeListenerCall = context.removeListener.getCall(0);
        assert.equal(removeListenerCall.args[0], context.properties.channelId);
    });

    it('receive', async () => {

        context.messages.webhook.content.data = {
            text: 'Hello, world!'
        };

        await NewChannelMessageRT.receive(context);

        // Assert the message was sent.
        assert.equal(context.sendJson.callCount, 1);
        const sendJsonCall = context.sendJson.getCall(0);
        assert.equal(sendJsonCall.args[0], context.messages.webhook.content.data);
        assert.equal(sendJsonCall.args[1], 'message');
    });
});
