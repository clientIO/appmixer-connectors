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
        context.flowDescriptor = {
            'componentId-1': {
                label: 'New Channel Message'
            }
        };
    });

    describe('start', async () => {

        it('ok', async () => {

            await NewChannelMessageRT.start(context);

            // Assert the listener was added.
            assert.equal(context.addListener.callCount, 1);
            const addListenerCall = context.addListener.getCall(0);
            assert.equal(addListenerCall.args[0], context.properties.channelId);
        });
        it('start - missing authToken', async () => {

            context.config.authToken = null;

            try {
                await NewChannelMessageRT.start(context);
            } catch (error) {
                assert.equal(error.message, 'Missing Slack configuration for component: New Channel Message. Please configure the "authToken" with a valid Slack App token.');
            }
        });
        it('start - missing authToken - AuthHub', async () => {
            context.config.authToken = null;
            context.config.usesAuthHub = true;

            await NewChannelMessageRT.start(context);

            // Assert the listener was added.
            assert.equal(context.addListener.callCount, 1);
            const addListenerCall = context.addListener.getCall(0);
            assert.equal(addListenerCall.args[0], context.properties.channelId);
        });
        it('start - missing signingSecret', async () => {

            context.config.signingSecret = null;

            try {
                await NewChannelMessageRT.start(context);
            } catch (error) {
                assert.equal(error.message, 'Missing Slack configuration for component: New Channel Message. Please configure the "signingSecret" with a valid Slack App signing secret.');
            }
        });
        it('start - missing signingSecret - AuthHub', async () => {

            context.config.signingSecret = null;
            context.config.usesAuthHub = true;

            await NewChannelMessageRT.start(context);

            // Assert the listener was added.
            assert.equal(context.addListener.callCount, 1);
            const addListenerCall = context.addListener.getCall(0);
            assert.equal(addListenerCall.args[0], context.properties.channelId);
        });
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
