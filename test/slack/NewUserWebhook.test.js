const assert = require('assert');
const testUtils = require('../utils.js');
const NewUserWebhook = require('../../src/appmixer/slack/list/NewUserWebhook/NewUserWebhook.js');

describe('NewUserWebhook', () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Set the profile info.
        context.auth = {
            accessToken: 'slack_access_token'
        };
        context.config = {
            signingSecret: 'signing_secret'
        };
        context.messages = { webhook: { content: { data: null } } };
    });

    it('start', async () => {

        await NewUserWebhook.start(context);

        // Assert the listener was added.
        assert.equal(context.addListener.callCount, 1);
        const addListenerCall = context.addListener.getCall(0);
        assert.equal(addListenerCall.args[0], 'slack_team_join');
    });

    it('stop', async () => {

        await NewUserWebhook.stop(context);

        // Assert the listener was removed.
        assert.equal(context.removeListener.callCount, 1);
        const removeListenerCall = context.removeListener.getCall(0);
        assert.equal(removeListenerCall.args[0], 'slack_team_join');
    });

    it('receive', async () => {

        context.messages.webhook.content.data = {
            text: 'Hello, world!'
        };

        await NewUserWebhook.receive(context);

        // Assert the message was sent.
        assert.equal(context.sendJson.callCount, 1);
        const sendJsonCall = context.sendJson.getCall(0);
        assert.equal(sendJsonCall.args[0], context.messages.webhook.content.data);
        assert.equal(sendJsonCall.args[1], 'user');
    });
});
