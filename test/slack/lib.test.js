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

    describe('sendMessage - asBot', () => {

        let context;
        const channelId = 'testChannelId';
        const message = 'testMessage';

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
            context.messages = {
                message: {
                    content: {
                        iconUrl: 'https://example.com/icon.png',
                        username: 'MySlackBot'
                    }
                }
            };
        });

        afterEach(() => {
            mockWebClient?.chat?.postMessage?.resetHistory();
            mockWebClient = null;
            delete require.cache[require.resolve('@slack/web-api')];
            require('@slack/web-api');
            process.env.AUTH_HUB_URL = undefined;
            process.env.AUTH_HUB_TOKEN = undefined;
        });

        it('should call web.chat.postMessage when not using AuthHub', async () => {
            context.config.botToken = 'testBotToken';

            const result = await sendMessage(context, channelId, message, true);

            assert.equal(mockWebClient.chat.postMessage.callCount, 1);
            assert.deepEqual(result, { text: 'testMessage' });
            assert.deepEqual(mockWebClient.chat.postMessage.getCall(0).args[0], {
                icon_url: 'https://example.com/icon.png',
                username: 'MySlackBot',
                channel: channelId,
                text: message
            });
        });

        it('should call web.chat.postMessage when using AuthHub but not as bot', async () => {
            context.config.usesAuthHub = true;
            context.config.botToken = undefined;

            const result = await sendMessage(context, channelId, message, false);
            assert.equal(mockWebClient.chat.postMessage.callCount, 1);
            assert.deepEqual(result, { text: 'testMessage' });
            assert.deepEqual(mockWebClient.chat.postMessage.getCall(0).args[0], {
                icon_url: undefined,
                username: undefined,
                channel: channelId,
                text: message
            });
        });

        it('should call AuthHub route when using AuthHub and as bot', async () => {

            process.env.AUTH_HUB_URL = 'https://auth-hub.example.com';
            process.env.AUTH_HUB_TOKEN = 'testAuthHubToken';
            context.config.usesAuthHub = true;

            context.httpRequest = sinon.stub().resolves({
                text: message
            });

            const result = await sendMessage(context, channelId, message, true);

            assert.deepEqual(result, { text: message });
            assert.equal(context.httpRequest.callCount, 1);
            assert.deepEqual(context.httpRequest.getCall(0).args[0], {
                url: process.env.AUTH_HUB_URL + '/plugins/appmixer/slack/auth-hub/send-message',
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.AUTH_HUB_TOKEN}`,
                    'x-appmixer-version-slack': require('../../src/appmixer/slack/bundle.json').version
                },
                data: {
                    iconUrl: 'https://example.com/icon.png',
                    username: 'MySlackBot',
                    channelId,
                    text: message
                }
            });
        });

        it('should throw an error when not using AuthHub and botToken is not available', async () => {
            context.config.usesAuthHub = undefined;
            context.config.botToken = undefined;

            await assert.rejects(
                sendMessage(context, channelId, message, true),
                Error,
                'Bot token is required for sending messages as bot. Please provide it in the connector configuration.'
            );
        });
    });
});
