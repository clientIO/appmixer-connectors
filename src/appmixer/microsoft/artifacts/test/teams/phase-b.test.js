const assert = require('assert');
const testUtils = require('../../../../../../test/utils.js');
const { chatMessage } = require('../../../teams/schemas.js');
const subscriptions = require('../../../teams/subscriptions.js');
const SendChannelMessage = require('../../../teams/SendChannelMessage/SendChannelMessage.js');
const SendChatMessage = require('../../../teams/SendChatMessage/SendChatMessage.js');
const AddReaction = require('../../../teams/AddReaction/AddReaction.js');
const RemoveReaction = require('../../../teams/RemoveReaction/RemoveReaction.js');
const ListChats = require('../../../teams/ListChats/ListChats.js');
const NewChatMessage = require('../../../teams/NewChatMessage/NewChatMessage.js');
const sendChatMessageJson = require('../../../teams/SendChatMessage/component.json');
const newChatMessageJson = require('../../../teams/NewChatMessage/component.json');

const BASE = 'https://graph.microsoft.com/v1.0';
const TEAM_ID = 'fbe2bf47-16c8-47cf-b4a5-4b9b187c508b';
const CHANNEL_ID = '19:4a95f7d8db4c4e7fae857bcebe0623e6@thread.tacv2';
const ENCODED_CHANNEL_ID = '19%3A4a95f7d8db4c4e7fae857bcebe0623e6%40thread.tacv2';
const CHAT_ID = '19:2da4c29f6d7041eca70b638b43d45437@thread.v2';
const ENCODED_CHAT_ID = encodeURIComponent(CHAT_ID);
const ME_ID = '8ea0e38b-efb3-4757-924a-5f94061cf8c2';
const MESSAGE_ID = '1616990032035';

const graphError = (status) => Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers: {}, data: { error: { code: 'ErrorCode', message: 'Failed' } } }
});

// Dispatch by path so a test can assert which endpoints were hit, in any order.
const routes = (map) => (options) => {

    const path = (options.url || '').replace(BASE, '');
    const handler = map[path];

    if (handler === undefined) {
        return Promise.reject(new Error(`unexpected request ${options.method} ${path}`));
    }
    return typeof handler === 'function' ? handler(options) : Promise.resolve({ data: handler });
};

describe('Microsoft Teams - phase B', function() {

    let context;

    beforeEach(function() {

        context = testUtils.createMockContext();
        context.auth = { accessToken: 'token' };
        context.properties = {};
        context.getWebhookUrl.returns('https://hooks.appmixer.test/abc');
    });

    describe('SendChannelMessage', function() {

        const base = `${BASE}/teams/${TEAM_ID}/channels/${ENCODED_CHANNEL_ID}/messages`;

        it('posts a reply under the root message and drops the subject', async function() {

            context.messages = {
                in: {
                    content: {
                        teamId: TEAM_ID,
                        channelId: CHANNEL_ID,
                        content: '<p>Hi</p>',
                        contentType: 'html',
                        subject: 'Ignored on replies',
                        importance: 'high',
                        replyToMessageId: MESSAGE_ID
                    }
                }
            };
            context.httpRequest.resolves({ data: { id: '1616990171266' } });

            await SendChannelMessage.receive(context);

            const request = context.httpRequest.args[0][0];
            assert.strictEqual(request.url, `${base}/${MESSAGE_ID}/replies`);
            assert.deepStrictEqual(request.data, {
                body: { contentType: 'html', content: '<p>Hi</p>' },
                importance: 'high'
            });
        });

        it('sets the subject and importance on a new conversation', async function() {

            context.messages = {
                in: {
                    content: {
                        teamId: TEAM_ID,
                        channelId: CHANNEL_ID,
                        content: 'Hi',
                        subject: 'Quarterly results',
                        importance: 'urgent'
                    }
                }
            };
            context.httpRequest.resolves({ data: { id: MESSAGE_ID } });

            await SendChannelMessage.receive(context);

            const request = context.httpRequest.args[0][0];
            assert.strictEqual(request.url, base);
            assert.deepStrictEqual(request.data, {
                body: { contentType: 'text', content: 'Hi' },
                importance: 'urgent',
                subject: 'Quarterly results'
            });
        });
    });

    describe('SendChatMessage', function() {

        const message = { id: MESSAGE_ID, chatId: CHAT_ID, body: { contentType: 'text', content: 'Hi' } };

        it('posts to an existing chat without creating one', async function() {

            context.messages = { in: { content: { chatId: CHAT_ID, content: 'Hi' } } };
            context.httpRequest.callsFake(routes({ [`/chats/${ENCODED_CHAT_ID}/messages`]: message }));

            await SendChatMessage.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 1);
            assert.deepStrictEqual(context.httpRequest.args[0][0].data, { body: { contentType: 'text', content: 'Hi' } });
            assert.deepStrictEqual(context.sendJson.args[0], [message, 'out']);
        });

        it('creates a one-on-one chat with the caller as a member', async function() {

            context.messages = { in: { content: { recipients: 'jacob@contoso.com', content: 'Hi' } } };
            context.httpRequest.callsFake(routes({
                '/me': { id: ME_ID },
                '/chats': { id: CHAT_ID },
                [`/chats/${ENCODED_CHAT_ID}/messages`]: message
            }));

            await SendChatMessage.receive(context);

            const created = context.httpRequest.args[1][0].data;
            assert.strictEqual(created.chatType, 'oneOnOne');
            assert.strictEqual(created.topic, undefined);
            assert.deepStrictEqual(created.members.map((member) => member['user@odata.bind']), [
                `${BASE}/users('${ME_ID}')`,
                `${BASE}/users('jacob@contoso.com')`
            ]);
            assert.deepStrictEqual(created.members[0], {
                '@odata.type': '#microsoft.graph.aadUserConversationMember',
                roles: ['owner'],
                'user@odata.bind': `${BASE}/users('${ME_ID}')`
            });
            assert.deepStrictEqual(context.sendJson.args[0], [message, 'out']);
        });

        it('creates a group chat with a topic for several recipients', async function() {

            context.messages = {
                in: { content: { recipients: ['a@contoso.com', 'b@contoso.com'], topic: 'Launch', content: 'Hi' } }
            };
            context.httpRequest.callsFake(routes({
                '/me': { id: ME_ID },
                '/chats': { id: CHAT_ID },
                [`/chats/${ENCODED_CHAT_ID}/messages`]: message
            }));

            await SendChatMessage.receive(context);

            const created = context.httpRequest.args[1][0].data;
            assert.strictEqual(created.chatType, 'group');
            assert.strictEqual(created.topic, 'Launch');
            assert.strictEqual(created.members.length, 3);
        });

        it('requires content, and a chat or recipients', async function() {

            context.messages = { in: { content: { chatId: CHAT_ID } } };
            await assert.rejects(SendChatMessage.receive(context), /Content is required!/);

            context.messages = { in: { content: { content: 'Hi', recipients: '  ,  ' } } };
            await assert.rejects(SendChatMessage.receive(context), /Chat or Recipients is required!/);

            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('declares the shared chatMessage schema on its output port', function() {

            assert.deepStrictEqual(sendChatMessageJson.outPorts[0].schema, JSON.parse(JSON.stringify(chatMessage)));
        });
    });

    describe('AddReaction / RemoveReaction', function() {

        const inputs = { teamId: TEAM_ID, channelId: CHANNEL_ID, messageId: MESSAGE_ID, reactionType: '👍' };

        it('reacts to a channel message', async function() {

            context.messages = { in: { content: { ...inputs } } };
            context.httpRequest.resolves({ data: undefined });

            await AddReaction.receive(context);

            const request = context.httpRequest.args[0][0];
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(
                request.url,
                `${BASE}/teams/${TEAM_ID}/channels/${ENCODED_CHANNEL_ID}/messages/${MESSAGE_ID}/setReaction`
            );
            assert.deepStrictEqual(request.data, { reactionType: '👍' });
            assert.deepStrictEqual(context.sendJson.args[0], [{}, 'out']);
        });

        it('reacts to a reply inside a channel', async function() {

            context.messages = { in: { content: { ...inputs, messageId: '1616990171266', parentMessageId: MESSAGE_ID } } };
            context.httpRequest.resolves({ data: undefined });

            await AddReaction.receive(context);

            assert.strictEqual(
                context.httpRequest.args[0][0].url,
                `${BASE}/teams/${TEAM_ID}/channels/${ENCODED_CHANNEL_ID}` +
                    `/messages/${MESSAGE_ID}/replies/1616990171266/setReaction`
            );
        });

        it('removes a reaction from a chat message', async function() {

            context.messages = {
                in: { content: { location: 'chat', chatId: CHAT_ID, messageId: MESSAGE_ID, reactionType: '👍' } }
            };
            context.httpRequest.resolves({ data: undefined });

            await RemoveReaction.receive(context);

            assert.strictEqual(
                context.httpRequest.args[0][0].url,
                `${BASE}/chats/${ENCODED_CHAT_ID}/messages/${MESSAGE_ID}/unsetReaction`
            );
            assert.deepStrictEqual(context.sendJson.args[0], [{}, 'out']);
        });

        it('validates the target before calling Graph', async function() {

            const cases = [
                [{ ...inputs, teamId: undefined }, /Team is required!/],
                [{ ...inputs, channelId: undefined }, /Channel is required!/],
                [{ location: 'chat', messageId: MESSAGE_ID, reactionType: '👍' }, /Chat is required!/],
                [{ ...inputs, messageId: undefined }, /Message ID is required!/],
                [{ ...inputs, reactionType: undefined }, /Reaction is required!/]
            ];

            for (const [content, error] of cases) {
                context.messages = { in: { content } };
                await assert.rejects(AddReaction.receive(context), error);
            }

            assert.strictEqual(context.httpRequest.callCount, 0);
        });
    });

    describe('ListChats', function() {

        const chats = [{ id: CHAT_ID, topic: 'Quarterly results', chatType: 'group' }];

        it('lists the chats of the signed-in user', async function() {

            context.messages = { in: { content: { outputType: 'array' } } };
            context.httpRequest.callsFake(routes({ '/me/chats': { value: chats } }));

            await ListChats.receive(context);

            assert.deepStrictEqual(context.httpRequest.args[0][0].params, { $top: 50 });
            assert.deepStrictEqual(context.sendJson.args[0], [{ result: chats, count: 1 }, 'out']);
        });

        it('labels a one-on-one chat with the other members and caches the source call', async function() {

            context.messages = { in: { content: { isSource: true } } };
            context.httpRequest.callsFake(routes({
                '/me': { id: ME_ID },
                '/me/chats': {
                    value: [{
                        id: CHAT_ID,
                        chatType: 'oneOnOne',
                        members: [
                            { userId: ME_ID, displayName: 'Me' },
                            { userId: 'other', displayName: 'Robin Kline' }
                        ]
                    }]
                }
            }));

            await ListChats.receive(context);
            await ListChats.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 2);
            const expected = { result: [{ id: CHAT_ID, label: 'Robin Kline' }] };
            assert.deepStrictEqual(context.sendJson.args[0][0], expected);
            assert.deepStrictEqual(context.sendJson.args[1][0], expected);
        });

        it('falls back to a plain listing when members cannot be expanded', async function() {

            let listings = 0;
            context.messages = { in: { content: { isSource: true } } };
            context.httpRequest.callsFake(routes({
                '/me': { id: ME_ID },
                '/me/chats': (options) => {

                    listings += 1;
                    if (options.params && options.params.$expand) {
                        return Promise.reject(graphError(403));
                    }
                    return Promise.resolve({ data: { value: chats } });
                }
            }));

            await ListChats.receive(context);

            assert.strictEqual(listings, 2);
            assert.deepStrictEqual(context.sendJson.args[0][0], {
                result: [{ id: CHAT_ID, label: 'Quarterly results' }]
            });
        });

        it('source call returns an empty list on error', async function() {

            context.messages = { in: { content: { isSource: true } } };
            context.httpRequest.rejects(graphError(401));

            await ListChats.receive(context);

            assert.deepStrictEqual(context.sendJson.args[0][0], { result: [] });
        });

        it('toSelectArray maps the source output', function() {

            assert.deepStrictEqual(
                ListChats.toSelectArray({ result: [{ id: CHAT_ID, label: 'Robin Kline' }] }),
                [{ label: 'Robin Kline', value: CHAT_ID }]
            );
            assert.deepStrictEqual(ListChats.toSelectArray(undefined), []);
        });
    });

    describe('NewChatMessage', function() {

        const message = {
            id: MESSAGE_ID,
            messageType: 'message',
            chatId: CHAT_ID,
            from: { user: { id: 'someone-else' } },
            body: { contentType: 'text', content: 'Hello' }
        };
        const messagePath = `/chats/${ENCODED_CHAT_ID}/messages/${MESSAGE_ID}`;
        const notification = (extra = {}) => ({
            webhook: {
                content: {
                    query: {},
                    data: {
                        value: [{
                            clientState: 'secret',
                            resource: `chats('${CHAT_ID}')/messages('${MESSAGE_ID}')`,
                            ...extra
                        }]
                    }
                }
            }
        });

        const watching = async () => {

            await context.stateSet('clientState', 'secret');
            await context.stateSet('meId', ME_ID);
            await context.stateSet('subscriptionId', 'sub-1');
            await context.stateSet('resource', `/chats/${CHAT_ID}/messages`);
            await context.stateSet('changeType', 'created');
        };

        it('subscribes to every chat of the user and schedules the renewal', async function() {

            context.httpRequest.callsFake(routes({ '/me': { id: ME_ID }, '/subscriptions': { id: 'sub-1' } }));

            await NewChatMessage.start(context);

            const body = context.httpRequest.args[1][0].data;
            assert.strictEqual(body.changeType, 'created');
            assert.strictEqual(body.resource, `/users/${ME_ID}/chats/getAllMessages`);
            assert.strictEqual(body.notificationUrl, 'https://hooks.appmixer.test/abc');
            // Without a lifecycle URL Graph caps the subscription at 60 minutes.
            assert.strictEqual(body.lifecycleNotificationUrl, body.notificationUrl);
            assert.match(body.clientState, /^[0-9a-f]{32}$/);
            assert.strictEqual(await context.stateGet('subscriptionId'), 'sub-1');
            assert.strictEqual(await context.stateGet('meId'), ME_ID);

            const delay = context.setTimeout.args[0][1];
            const expected = subscriptions.LIFETIME_MS - subscriptions.RENEW_BEFORE_MS;
            assert.ok(delay <= expected && delay > expected - 5000, `renewal scheduled at ${delay}`);
        });

        it('subscribes to a single chat when one is configured', async function() {

            context.properties = { chatId: CHAT_ID };
            context.httpRequest.callsFake(routes({ '/me': { id: ME_ID }, '/subscriptions': { id: 'sub-1' } }));

            await NewChatMessage.start(context);

            assert.strictEqual(context.httpRequest.args[1][0].data.resource, `/chats/${CHAT_ID}/messages`);
        });

        it('answers the validation handshake without touching Graph', async function() {

            context.messages = { webhook: { content: { query: { validationToken: 'vt' } } } };

            await NewChatMessage.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            assert.ok(context.response.calledWith('vt', 200, { 'Content-type': 'text/plain' }));
        });

        it('emits the message the notification points at', async function() {

            await watching();
            context.messages = notification();
            context.httpRequest.callsFake(routes({ [messagePath]: message }));

            await NewChatMessage.receive(context);

            assert.deepStrictEqual(context.sendJson.args[0], [message, 'out']);
            assert.ok(context.response.calledWith('', 200));
        });

        it('drops a notification whose clientState does not match', async function() {

            await watching();
            context.messages = notification({ clientState: 'someone-else' });

            await NewChatMessage.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            assert.strictEqual(context.sendJson.callCount, 0);
        });

        it('skips the user own messages and system events', async function() {

            await watching();
            context.messages = notification();
            context.httpRequest.callsFake(routes({
                [messagePath]: { ...message, from: { user: { id: ME_ID } } }
            }));
            await NewChatMessage.receive(context);
            assert.strictEqual(context.sendJson.callCount, 0);

            context.httpRequest.callsFake(routes({
                [messagePath]: { ...message, messageType: 'systemEventMessage' }
            }));
            await NewChatMessage.receive(context);
            assert.strictEqual(context.sendJson.callCount, 0);
        });

        it('keeps going when the message was deleted before it could be read', async function() {

            await watching();
            context.messages = notification();
            context.httpRequest.callsFake(routes({ [messagePath]: () => Promise.reject(graphError(404)) }));

            await NewChatMessage.receive(context);

            assert.strictEqual(context.sendJson.callCount, 0);
            assert.ok(context.response.calledWith('', 200));
        });

        it('renews the subscription on the timeout', async function() {

            await watching();
            context.messages = { timeout: {} };
            context.httpRequest.callsFake(routes({ '/subscriptions/sub-1': {} }));

            await NewChatMessage.receive(context);

            const request = context.httpRequest.args[0][0];
            assert.strictEqual(request.method, 'PATCH');
            assert.ok(new Date(request.data.expirationDateTime) > new Date());
            assert.strictEqual(context.setTimeout.callCount, 1);
        });

        it('rebuilds a subscription Graph has already dropped', async function() {

            await watching();
            context.messages = { timeout: {} };
            context.httpRequest.callsFake(routes({
                '/subscriptions/sub-1': () => Promise.reject(graphError(404)),
                '/subscriptions': { id: 'sub-2' }
            }));

            await NewChatMessage.receive(context);

            assert.strictEqual(await context.stateGet('subscriptionId'), 'sub-2');
            assert.strictEqual(context.setTimeout.callCount, 1);
        });

        it('recreates the subscription on a subscriptionRemoved lifecycle event', async function() {

            await watching();
            context.messages = notification({ lifecycleEvent: 'subscriptionRemoved' });
            context.httpRequest.callsFake(routes({ '/subscriptions': { id: 'sub-2' } }));

            await NewChatMessage.receive(context);

            assert.strictEqual(await context.stateGet('subscriptionId'), 'sub-2');
            assert.strictEqual(context.sendJson.callCount, 0);
        });

        it('reauthorizes and extends on a reauthorizationRequired lifecycle event', async function() {

            await watching();
            context.messages = notification({ lifecycleEvent: 'reauthorizationRequired' });
            context.httpRequest.callsFake(routes({
                '/subscriptions/sub-1/reauthorize': {},
                '/subscriptions/sub-1': {}
            }));

            await NewChatMessage.receive(context);

            const paths = context.httpRequest.args.map((args) => args[0].url.replace(BASE, ''));
            assert.deepStrictEqual(paths, ['/subscriptions/sub-1/reauthorize', '/subscriptions/sub-1']);
            assert.strictEqual(await context.stateGet('subscriptionId'), 'sub-1');
        });

        it('deletes the subscription on stop and tolerates one already gone', async function() {

            await watching();
            context.httpRequest.callsFake(routes({ '/subscriptions/sub-1': {} }));

            await NewChatMessage.stop(context);

            assert.strictEqual(context.httpRequest.args[0][0].method, 'DELETE');
            assert.strictEqual(await context.stateGet('subscriptionId'), undefined);

            await watching();
            context.httpRequest.callsFake(routes({ '/subscriptions/sub-1': () => Promise.reject(graphError(404)) }));
            await NewChatMessage.stop(context);
        });

        it('test() emits the newest message of the watched chat', async function() {

            context.properties = { chatId: CHAT_ID };
            context.httpRequest.callsFake(routes({
                '/me': { id: ME_ID },
                [`/chats/${ENCODED_CHAT_ID}/messages`]: { value: [{ id: MESSAGE_ID }] },
                [messagePath]: message
            }));

            await NewChatMessage.test(context);

            const listing = context.httpRequest.args[0][0];
            assert.deepStrictEqual(listing.params, { $top: 1, $orderby: 'createdDateTime desc' });
            assert.deepStrictEqual(context.sendJson.args[0], [message, 'out']);
            // Test mode must not touch the subscription state.
            assert.strictEqual(context.stateSet.callCount, 0);
        });

        it('test() throws when the chat has no message to sample', async function() {

            context.properties = { chatId: CHAT_ID };
            context.httpRequest.callsFake(routes({ [`/chats/${ENCODED_CHAT_ID}/messages`]: { value: [] } }));

            await assert.rejects(NewChatMessage.test(context), /No recent messages/);
        });

        it('declares the shared chatMessage schema on its output port', function() {

            assert.deepStrictEqual(newChatMessageJson.outPorts[0].schema, JSON.parse(JSON.stringify(chatMessage)));
            assert.strictEqual(newChatMessageJson.webhook, true);
            assert.strictEqual(newChatMessageJson.inPorts, undefined);
        });
    });
});
