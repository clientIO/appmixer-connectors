const fs = require('fs');
const { cwd } = require('process');
const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
require('@slack/web-api');

// Mock the WebClient class from @slack/web-api
// This is necessary to avoid making actual API calls during tests
// and to control the behavior of the WebClient in tests.
let mockWebClient = null;
const mockWebClientClass = class {
    constructor(token) {
        this.token = token;
        // With this, we can further modify the mockWebClient in the tests.
        mockWebClient = this;
    }
    chat = {
        postMessage: sinon.stub().resolves({ message: { text: 'testMessage' } })
    };
};
require.cache[require.resolve('@slack/web-api')].exports = {
    WebClient: mockWebClientClass
};

const { sendMessage } = require('../../src/appmixer/slack/lib.js');

describe('lib.js', () => {

    describe('sendMessage', () => {

        let context;

        before(() => {
            // Stop if there are node modules installed in the connector folder.
            const connectorPath = cwd() + '/src/appmixer/slack/node_modules';
            if (fs.existsSync(connectorPath)) {
                throw new Error(`For testing, please remove node_modules from ${connectorPath}`);
            }
        });

        beforeEach(() => {
            context = testUtils.createMockContext();
            context.auth = {
                accessToken: 'testAccessToken'
            };
        });

        afterEach(() => {
            mockWebClient.chat.postMessage.resetHistory();
            mockWebClient = null;
            delete require.cache[require.resolve('@slack/web-api')];
            require('@slack/web-api');
        });

        it('should call web.chat.postMessage when not using AuthHub', async () => {
            const channelId = 'testChannelId';
            const message = 'testMessage';
            context.config.botToken = 'testBotToken';

            const result = await sendMessage(context, channelId, message);

            assert.equal(mockWebClient.chat.postMessage.callCount, 1);
            assert.deepEqual(result, { text: 'testMessage' });
            assert.deepEqual(mockWebClient.chat.postMessage.getCall(0).args[0], {
                icon_url: undefined,
                username: undefined,
                channel: channelId,
                text: message
            });
        });

        it('should call context.callAppmixer when using AuthHub', async () => {
            const channelId = 'testChannelId';
            const message = 'testMessage';
            context.config.usesAuthHub = true;

            context.callAppmixer = sinon.stub().resolves({ data: { text: message } });

            const result = await sendMessage(context, channelId, message);

            assert.deepEqual(result, { text: message });
            assert.equal(context.callAppmixer.callCount, 1);
            assert.deepEqual(context.callAppmixer.getCall(0).args[0], {
                componentId: 'appmixer.slack.SendMessage',
                transform: false,
                data: {
                    channelId: channelId,
                    text: message
                }
            });
        });

        it('should throw an error when using AuthHub and botToken is not available', async () => {
            const channelId = 'testChannelId';
            const message = 'testMessage';
            context.config.usesAuthHub = false;
            delete context.config.botToken;

            await assert.rejects(
                sendMessage(context, channelId, message),
                Error,
                'Bot token is required for sending messages as bot. Please provide it in the connector configuration.'
            );
        });
    });
});
