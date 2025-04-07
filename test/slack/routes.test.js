const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const routes = require('../../src/appmixer/slack/routes.js');
const { createHmac } = require('node:crypto');

describe('POST /events handler', () => {

    let context = testUtils.createMockContext();
    let handler;
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

        context.config = {
            signingSecret: 'signing_secret',
            usesAuthHub: false
        };

        h = {
            response: sinon.stub().returns({ code: sinon.stub() })
        };
        // Register the routes the same way Appmixer does.
        await routes(context);
        // Get the right handler for the POST /events route - our HubSpot triggers.
        handler = context.http.router.register.getCall(0).args[0].options.handler;
        // Stubs common to all tests.
        context.triggerComponent.resolves();
    });

    it('call to context.onListenerAdded should do accessToken check', async () => {

        // Stub the HTTP requests to Slack API.
        // First is to get all webhook subscriptions
        context.httpRequest.onCall(0).resolves({
            statusCode: 200,
            data: {
                user_id: 'U01'
            }
        });
        // Second is to create a new webhook subscriptions
        context.httpRequest.onCall(1).resolves({
            statusCode: 200
        });

        const handler = context.onListenerAdded.getCall(0).args[0];
        await handler({
            params: {
                accessToken: 'slack_access_token'
            }
        });
        assert.equal(context.httpRequest.callCount, 1, 'httpRequest should be called once');
    });

    it('unknown event type', async () => {

        // The payload contains an unknown event type.
        const payload = {
            type: 'emoji_changed',
            subtype: 'remove',
            names: ['picard_facepalm'],
            event_ts: '1361482916.000004'
        };
        const timestamp = '1361482916';
        const signingSecret = 'signing_secret';
        const payloadString = JSON.stringify(payload);
        const baseString = `v0:${timestamp}:${payloadString}`;
        const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');

        const req = {
            payload: payload,
            headers: {
                'x-slack-signature': mySignature,
                'x-slack-request-timestamp': timestamp
            }
        };

        // Call the handler with the payload.
        await handler(req, h);

        // Assertions
        // Expecting no calls to triggerListeners.
        assert.equal(context.triggerListeners.callCount, 0, 'triggerListeners should not be called');
    });

    describe('messages', () => {

        it('message.im', async () => {

            // Fixtures
            const CHANNEL_ID = 'D024BE91L';
            const payload = {
                token: 'one-long-verification-token',
                team_id: 'T061EG9R6',
                api_app_id: 'A0PNCHHK2',
                event: {
                    type: 'message',
                    channel: CHANNEL_ID,
                    user: 'U2147483697',
                    text: 'Hello hello can you hear me?',
                    ts: '1355517523.000005',
                    event_ts: '1355517523.000005',
                    channel_type: 'im'
                },
                type: 'event_callback',
                authed_teams: [
                    'T061EG9R6'
                ],
                event_id: 'Ev0PV52K21',
                event_time: 1355517523
            };
            const timestamp = '1355517523';
            const signingSecret = 'signing_secret';
            const payloadString = JSON.stringify(payload);
            const baseString = `v0:${timestamp}:${payloadString}`;
            const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');

            const req = {
                payload: payload,
                headers: {
                    'x-slack-signature': mySignature,
                    'x-slack-request-timestamp': timestamp
                }
            };

            // Stub the HTTP requests to Slack API: https://slack.com/api/apps.event.authorizations.list
            context.httpRequest.resolves({
                statusCode: 200,
                data: {
                    authorizations: [
                        {
                            enterprise_id: 'E123',
                            team_id: 'T061EG9R6',
                            user_id: 'U061F7AUR',
                            is_bot: true,
                            is_enterprise_install: false
                        }
                    ]
                }
            });

            // Call the handler with the payload.
            await handler(req, h);

            assert.equal(context.httpRequest.callCount, 1, 'httpRequest should be called once');

            // Assertions
            // Expecting 1 call to triggerListeners.
            assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');

            // Assert channel ID and event are the same.
            assert.equal(context.triggerListeners.getCall(0).args[0].eventName, CHANNEL_ID, 'triggerListeners should be called with the correct channel ID');
            assert.deepEqual(context.triggerListeners.getCall(0).args[0].payload, req.payload.event, 'triggerListeners should be called with the correct event');
            assert.equal(typeof context.triggerListeners.getCall(0).args[0].filter, 'function', 'triggerListeners should be called with a filter function');
        });
    });

    describe('users', () => {

        it('team_join', async () => {

            // Fixtures
            const EVENT_NAME = 'slack_team_join';
            const payload = {
                token: 'nqOj9fVV0kpyxkKsd1EEe76m',
                team_id: 'T07XXUJTGNB',
                api_app_id: 'A07XX083UD9',
                event: {
                    type: 'team_join',
                    user: {
                        id: 'U07XX2HP37H',
                        team_id: 'T07XXUJTGNB',
                        name: 'jirka',
                        deleted: false,
                        real_name: 'user-jirka-client-io',
                        tz: 'Europe/Belgrade',
                        tz_label: 'Central European Summer Time',
                        tz_offset: 7200,
                        profile: {
                            title: '',
                            phone: '',
                            skype: '',
                            real_name: 'user-jirka-client-io',
                            real_name_normalized: 'user-jirka-client-io',
                            display_name: 'user-jirka-client-io',
                            display_name_normalized: 'user-jirka-client-io',
                            fields: {},
                            status_text: '',
                            status_emoji: '',
                            status_emoji_display_info: [],
                            status_expiration: 0,
                            avatar_hash: 'g49495797581',
                            email: 'jirka@client.io',
                            first_name: 'user-jirka-client-io',
                            last_name: '',
                            image_24: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=24&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-24.png',
                            image_32: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=32&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-32.png',
                            image_48: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=48&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-48.png',
                            image_72: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=72&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-72.png',
                            image_192: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=192&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-192.png',
                            image_512: 'https://secure.gravatar.com/avatar/4949579758168ab9e90b303edd096067.jpg?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0014-512.png',
                            status_text_canonical: '',
                            team: 'T07XXUJTGNB'
                        },
                        is_admin: false,
                        is_owner: false,
                        is_primary_owner: false,
                        is_restricted: false,
                        is_ultra_restricted: false,
                        is_bot: false,
                        is_app_user: false,
                        updated: 1729856452,
                        is_email_confirmed: true,
                        who_can_share_contact_card: 'EVERYONE',
                        presence: 'away'
                    }
                },
                type: 'event_callback',
                event_id: 'Ev07TW997DEV',
                event_time: 1729856453,
                authorizations: [{
                    enterprise_id: null,
                    team_id: 'T07XXUJTGNB',
                    user_id: 'U07XXCHPJQK',
                    is_bot: false,
                    is_enterprise_install: false
                }],
                is_ext_shared_channel: false
            };

            const timestamp = '1729856453';
            const signingSecret = 'signing_secret';
            const payloadString = JSON.stringify(payload)
                .replace(/\//g, '\\/')
                .replace(/[\u007f-\uffff]/g, (c) => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
            const baseString = `v0:${timestamp}:${payloadString}`;
            const mySignature = 'v0=' + createHmac('sha256', signingSecret).update(baseString).digest('hex');

            const req = {
                payload: payload,
                headers: {
                    'x-slack-signature': mySignature,
                    'x-slack-request-timestamp': timestamp
                }
            };

            // Call the handler with the payload.
            await handler(req, h);

            // Assertions
            // Expecting 1 call to triggerListeners.
            assert.equal(context.triggerListeners.callCount, 1, 'triggerListeners should be called once');

            // Assert channel ID and event are the same.
            assert.equal(context.triggerListeners.getCall(0).args[0].eventName, EVENT_NAME, 'triggerListeners should be called with the correct channel ID');
            // Assert user details are passed to the triggerListeners. Real name and profile email are expected.
            assert.deepEqual(context.triggerListeners.getCall(0).args[0].payload.real_name, req.payload.event.user.real_name, 'triggerListeners should be called with the correct user real name');
            assert.deepEqual(context.triggerListeners.getCall(0).args[0].payload.profile.email, req.payload.event.user.profile.email, 'triggerListeners should be called with the correct user email');
        });
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
});
