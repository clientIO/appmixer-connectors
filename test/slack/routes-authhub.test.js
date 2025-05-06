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

const routes = require('../../src/appmixer/slack/routes.js');

describe('POST /send-message handler', () => {

    let context = testUtils.createMockContext();
    // Stub the h.response object.
    let h;

    beforeEach(async () => {

        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            // Routes/plugins specific stubs
            http: {
                router: {
                    register: sinon.stub()
                }
            }
        };

        h = {
            response: sinon.stub().returns({ code: sinon.stub() })
        };
        // Flag it as AuthHub pod
        process.env.AUTH_HUB_URL = 'https://auth-hub.example.com';
        delete process.env.AUTH_HUB_TOKEN;

        // Register the routes the same way Appmixer does.
        await routes(context);
    });

    afterEach(() => {
        // Reset the context
        delete process.env.AUTH_HUB_URL;
        delete process.env.AUTH_HUB_TOKEN;
        mockWebClient?.chat?.postMessage?.resetHistory();
        mockWebClient = null;
        delete require.cache[require.resolve('@slack/web-api')];
        require('@slack/web-api');
    });

    it('auth-hub/send-message with valid params', async () => {
        // Get the handler for the POST /auth-hub/send-message route
        const sendMessageHandler = context.http.router.register.getCall(1).args[0].options.handler;

        // Mock successful message sending
        context.config.botToken = 'mock_bot_token';

        // Create request with valid params
        const req = {
            payload: {
                iconUrl: 'http://example.com/icon.png',
                username: 'TestBot',
                channelId: 'C12345',
                text: 'Test message'
            }
        };

        // Call the handler
        await sendMessageHandler(req, h);

        // Assert correct response
        assert.equal(h.response.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.getCall(0).args[0], 200);
    });

    it('auth-hub/send-message with missing params', async () => {
        // Get the handler for the POST /auth-hub/send-message route
        const sendMessageHandler = context.http.router.register.getCall(1).args[0].options.handler;

        // Create request with missing params
        const req = {
            payload: {
                iconUrl: 'http://example.com/icon.png',
                username: 'TestBot'
                // Missing channelId and text
            }
        };

        // Call the handler
        await sendMessageHandler(req, h);

        // Assert error response
        assert.equal(h.response.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.getCall(0).args[0], 400);
    });

    it('auth-hub/send-message with thread_ts and reply_broadcast', async () => {
        const sendMessageHandler = context.http.router.register.getCall(1).args[0].options.handler;
        context.config.botToken = 'mock_bot_token';
        const req = {
            payload: {
                iconUrl: 'http://example.com/icon.png',
                username: 'TestBot',
                channelId: 'C12345',
                text: 'Test message',
                thread_ts: '1234567890.123456',
                reply_broadcast: true
            }
        };
        await sendMessageHandler(req, h);
        assert.equal(h.response.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.getCall(0).args[0], 200);
        assert.equal(mockWebClient.chat.postMessage.callCount, 1);
        assert.deepEqual(mockWebClient.chat.postMessage.getCall(0).args[0], {
            icon_url: 'http://example.com/icon.png',
            username: 'TestBot',
            channel: 'C12345',
            text: 'Test message',
            thread_ts: '1234567890.123456',
            reply_broadcast: true
        });
    });

    it('auth-hub/send-message without thread_ts and reply_broadcast', async () => {
        const sendMessageHandler = context.http.router.register.getCall(1).args[0].options.handler;
        context.config.botToken = 'mock_bot_token';
        const req = {
            payload: {
                iconUrl: 'http://example.com/icon.png',
                username: 'TestBot',
                channelId: 'C12345',
                text: 'Test message'
            }
        };
        await sendMessageHandler(req, h);
        assert.equal(h.response.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.callCount, 1);
        assert.equal(h.response.getCall(0).returnValue.code.getCall(0).args[0], 200);
        assert.equal(mockWebClient.chat.postMessage.callCount, 1);
        assert.deepEqual(mockWebClient.chat.postMessage.getCall(0).args[0], {
            icon_url: 'http://example.com/icon.png',
            username: 'TestBot',
            channel: 'C12345',
            text: 'Test message'
        });
    });
});
