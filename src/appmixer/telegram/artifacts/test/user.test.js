'use strict';

const assert = require('assert');
const sinon = require('sinon');
const bigInt = require('big-integer');
const { Api } = require('teleproto');
const { RPCMessageToError } = require('teleproto/errors');
const testUtils = require('../../../../../test/utils');
const lib = require('../../user/lib');
const auth = require('../../user/auth');
const NewChannelPost = require('../../user/NewChannelPost/NewChannelPost');
const FindChannelMessages = require('../../user/FindChannelMessages/FindChannelMessages');
const GetChannel = require('../../user/GetChannel/GetChannel');

/**
 * An in-memory Telegram that answers the four requests the module makes, with the paging
 * semantics of messages.getHistory: messages are ordered newest first, offset_id /
 * offset_date pick the starting point, add_offset shifts it (negative = towards newer
 * messages), then limit, min_id and max_id apply.
 */
class FakeTelegram {

    constructor() {

        this.channels = new Map();
        this.calls = [];
        this.failures = [];
        this.appmixerKey = `test-${Math.random()}`;
    }

    addChannel(username, { id, title = username, messages = 0, flags = {} } = {}) {

        const channel = { id, title, username, accessHash: bigInt(String(id)).multiply(7919), flags, messages: [] };
        this.channels.set(username.toLowerCase(), channel);
        this.post(username, messages);
        return channel;
    }

    post(username, count = 1, extra = {}) {

        const channel = this.channels.get(username.toLowerCase());
        for (let i = 0; i < count; i++) {
            const id = (channel.messages.length ? channel.messages[channel.messages.length - 1].id : 0) + 1;
            channel.messages.push({
                className: 'Message',
                id,
                date: 1700000000 + id * 60,
                message: `post ${id}`,
                views: id * 10,
                forwards: 1,
                ...extra
            });
        }
    }

    // Fail the next request whose class name matches, for the given channel id if set.
    failNext(className, errorMessage, errorCode, channelId) {

        this.failures.push({ className, errorMessage, errorCode, channelId });
    }

    count(className) {

        return this.calls.filter(call => call === className).length;
    }

    channelObject(channel) {

        return new Api.Channel({
            id: bigInt(channel.id),
            title: channel.title,
            username: channel.username,
            accessHash: channel.accessHash,
            photo: new Api.ChatPhotoEmpty(),
            date: 1500000000,
            ...channel.flags
        });
    }

    byId(id) {

        return [...this.channels.values()].find(channel => String(channel.id) === String(id));
    }

    async invoke(request) {

        this.calls.push(request.className);

        const peerId = request.peer ? String(request.peer.channelId) : null;
        const index = this.failures.findIndex(failure => failure.className === request.className
            && (!failure.channelId || String(failure.channelId) === peerId));
        if (index !== -1) {
            const [failure] = this.failures.splice(index, 1);
            throw RPCMessageToError({ errorMessage: failure.errorMessage, errorCode: failure.errorCode }, request);
        }

        switch (request.className) {
            case 'users.GetUsers':
                return [this.me || new Api.User({ id: bigInt(42), firstName: 'Jana', username: 'jana' })];
            case 'contacts.ResolveUsername': {
                const channel = this.channels.get(request.username.toLowerCase());
                if (!channel) {
                    throw RPCMessageToError({ errorMessage: 'USERNAME_NOT_OCCUPIED', errorCode: 400 }, request);
                }
                return {
                    peer: new Api.PeerChannel({ channelId: bigInt(channel.id) }),
                    chats: [this.channelObject(channel)]
                };
            }
            case 'channels.GetFullChannel': {
                const channel = this.byId(request.channel.channelId);
                return {
                    fullChat: { about: 'About the channel', participantsCount: 1234, linkedChatId: bigInt(777) },
                    chats: [this.channelObject(channel)]
                };
            }
            case 'messages.GetHistory': {
                const channel = this.byId(request.peer.channelId);
                assert.strictEqual(String(request.peer.accessHash), String(channel.accessHash), 'wrong access hash');
                const newestFirst = [...channel.messages].reverse();
                let start = 0;
                if (request.offsetId) {
                    start = newestFirst.findIndex(message => message.id < request.offsetId);
                    start = start === -1 ? newestFirst.length : start;
                } else if (request.offsetDate) {
                    start = newestFirst.findIndex(message => message.date < request.offsetDate);
                    start = start === -1 ? newestFirst.length : start;
                }
                start += request.addOffset;
                const end = start + request.limit;
                const messages = newestFirst
                    .slice(Math.max(start, 0), Math.max(end, 0))
                    .filter(message => !request.minId || message.id > request.minId)
                    .filter(message => !request.maxId || message.id < request.maxId);
                return { messages, chats: [this.channelObject(channel), ...(this.extraChats || [])] };
            }
            default:
                throw new Error(`Unexpected request ${request.className}`);
        }
    }
}

describe('telegram.user', function() {

    let telegram;
    let context;
    let sent;

    const createContext = (properties = {}) => {

        // createMockContext() restores every sinon stub, so the client stub is set up after it.
        const ctx = testUtils.createMockContext();
        sinon.stub(lib, 'getClient').callsFake(async () => telegram);
        let state = {};
        sent = [];
        ctx.properties = properties;
        ctx.auth = { apiId: '1', apiHash: 'hash', session: 'session' };
        ctx.state = state;
        ctx.saveState = sinon.stub().callsFake(async (value) => {
            state = JSON.parse(JSON.stringify(value));
            ctx.state = state;
        });
        ctx.loadState = sinon.stub().callsFake(async () => state);
        ctx.sendJson = sinon.stub().callsFake(async (data, port) => {
            sent.push({ data, port });
        });
        ctx.log = sinon.stub().callsFake(async (severity, data) => {
            // Same contract as the engine: context.log(object) or context.log(severity, object).
            if (typeof severity === 'string') {
                assert.strictEqual(typeof data, 'object');
            } else {
                assert.strictEqual(typeof severity, 'object');
                assert.strictEqual(data, undefined);
            }
        });
        ctx.lock = sinon.stub().callsFake(async () => ({
            extend: sinon.stub().resolves(),
            unlock: sinon.stub().resolves()
        }));
        return ctx;
    };

    const sentIds = () => sent.filter(item => item.port === 'out').map(item => item.data.id);

    beforeEach(function() {

        telegram = new FakeTelegram();
        context = createContext({ channels: '@news' });
    });

    afterEach(function() {

        sinon.restore();
    });

    describe('NewChannelPost', function() {

        it('start() records the newest post as the baseline and keeps the channel reference', async function() {

            const channel = telegram.addChannel('news', { id: 1001, messages: 5 });
            await NewChannelPost.start(context);

            assert.deepStrictEqual(context.state.lastIds, { news: 5 });
            assert.deepStrictEqual(context.state.channels.news, {
                id: '1001',
                accessHash: String(channel.accessHash),
                username: 'news',
                title: 'news'
            });
        });

        it('start() fails for a channel that does not exist', async function() {

            await assert.rejects(NewChannelPost.start(context), (error) => {
                assert.ok(error instanceof context.CancelError);
                assert.match(error.message, /@news does not exist/);
                return true;
            });
        });

        it('emits nothing when there is nothing new and never resolves the username again', async function() {

            telegram.addChannel('news', { id: 1002, messages: 5 });
            await NewChannelPost.start(context);
            await NewChannelPost.tick(context);
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), []);
            assert.strictEqual(telegram.count('contacts.ResolveUsername'), 1);
        });

        it('emits new posts oldest first with the documented fields', async function() {

            telegram.addChannel('news', { id: 1003, title: 'News', messages: 5 });
            await NewChannelPost.start(context);
            telegram.post('news', 3);
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), [6, 7, 8]);
            assert.deepStrictEqual(sent[0].data, {
                id: 6,
                date: new Date((1700000000 + 6 * 60) * 1000).toISOString(),
                text: 'post 6',
                url: 'https://t.me/news/6',
                views: 60,
                forwards: 1,
                replies: null,
                media_type: null,
                fwd_from_channel: null,
                fwd_from_channel_id: null,
                fwd_from_message_id: null,
                reply_to_id: null,
                grouped_id: null,
                edit_date: null,
                post_author: null,
                channel_id: '1003',
                channel_username: 'news',
                channel_title: 'News'
            });
            assert.strictEqual(context.state.lastIds.news, 8);

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sentIds(), [6, 7, 8]);
        });

        it('reads a backlog over several ticks, in order and without duplicates', async function() {

            telegram.addChannel('news', { id: 1004, messages: 3 });
            await NewChannelPost.start(context);
            telegram.post('news', 450);

            await NewChannelPost.tick(context);
            assert.strictEqual(sent.length, 200);
            await NewChannelPost.tick(context);
            assert.strictEqual(sent.length, 400);
            await NewChannelPost.tick(context);
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), Array.from({ length: 450 }, (_, i) => i + 4));
        });

        it('skips service messages but moves past them', async function() {

            telegram.addChannel('news', { id: 1005, messages: 2 });
            await NewChannelPost.start(context);
            telegram.post('news', 1, { className: 'MessageService' });
            telegram.post('news', 1);
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), [4]);
            assert.strictEqual(context.state.lastIds.news, 4);
        });

        it('keeps reading when the last seen post was deleted', async function() {

            const channel = telegram.addChannel('news', { id: 1006, messages: 5 });
            await NewChannelPost.start(context);
            telegram.post('news', 2);
            channel.messages = channel.messages.filter(message => message.id !== 5);
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), [6, 7]);
        });

        it('labels posts with the current username after the channel was renamed', async function() {

            const channel = telegram.addChannel('news', { id: 1007, messages: 1 });
            await NewChannelPost.start(context);
            channel.username = 'news_renamed';
            telegram.post('news', 1);
            await NewChannelPost.tick(context);

            assert.strictEqual(sent[0].data.url, 'https://t.me/news_renamed/2');
            assert.strictEqual(context.state.channels.news.username, 'news_renamed');
            assert.strictEqual(telegram.count('contacts.ResolveUsername'), 1);
        });

        it('a FLOOD_WAIT postpones the rest to the next tick instead of failing', async function() {

            context = createContext({ channels: '@first, @second' });
            telegram.addChannel('first', { id: 1008, messages: 1 });
            telegram.addChannel('second', { id: 1009, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('first', 1);
            telegram.post('second', 1);
            telegram.failNext('messages.GetHistory', 'FLOOD_WAIT_3600', 420, 1009);

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sent.map(item => item.data.channel_username), ['first']);
            assert.strictEqual(context.log.callCount, 1);
            assert.strictEqual(context.log.firstCall.args[0], 'warn');
            assert.strictEqual(context.log.firstCall.args[1].seconds, 3600);

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sent.map(item => item.data.channel_username), ['first', 'second']);
        });

        it('a channel that went private does not stop the other channels', async function() {

            context = createContext({ channels: '@first, @second' });
            telegram.addChannel('first', { id: 1010, messages: 1 });
            telegram.addChannel('second', { id: 1011, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('first', 1);
            telegram.post('second', 1);
            telegram.failNext('messages.GetHistory', 'CHANNEL_PRIVATE', 400, 1010);

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sent.map(item => item.data.channel_username), ['second']);
            assert.strictEqual(context.log.firstCall.args[0], 'error');
            assert.match(context.log.firstCall.args[1].message, /private or not accessible/);
        });

        it('does not send posts again after a failure in the middle of a batch', async function() {

            telegram.addChannel('news', { id: 1012, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 4);
            const send = context.sendJson;
            context.sendJson = sinon.stub().callsFake(async (data, port) => {
                if (data.id === 4) {
                    throw new Error('queue unavailable');
                }
                return send(data, port);
            });

            await assert.rejects(NewChannelPost.tick(context), /queue unavailable/);
            assert.deepStrictEqual(sentIds(), [2, 3]);

            context.sendJson = send;
            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sentIds(), [2, 3, 4, 5]);
        });

        it('skips the tick while another tick of the component holds the lock', async function() {

            telegram.addChannel('news', { id: 1013, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 2);
            const lockError = new Error('Exceeded 1 attempts to lock the resource');
            lockError.name = 'LockError';
            context.lock = sinon.stub().rejects(lockError);

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sentIds(), []);
            assert.strictEqual(context.state.lastIds.news, 1);
        });

        it('fails the tick when the lock cannot be taken for another reason than contention', async function() {

            telegram.addChannel('news', { id: 1017, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 2);
            context.lock = sinon.stub().rejects(new Error('Redis is down'));

            await assert.rejects(NewChannelPost.tick(context), /Redis is down/);
            assert.deepStrictEqual(sentIds(), []);
            assert.strictEqual(context.state.lastIds.news, 1);
        });

        it('saves the cursor after every delivery', async function() {

            telegram.addChannel('news', { id: 1018, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 3);
            const saved = [];
            const save = context.saveState;
            context.saveState = sinon.stub().callsFake(async (value) => {
                saved.push({ cursor: value.lastIds.news, delivered: sent.length });
                return save(value);
            });

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(saved.slice(0, 3), [
                { cursor: 2, delivered: 1 },
                { cursor: 3, delivered: 2 },
                { cursor: 4, delivered: 3 }
            ]);
        });

        it('a revoked session fails the tick instead of being logged channel by channel', async function() {

            context = createContext({ channels: '@first, @second' });
            telegram.addChannel('first', { id: 1019, messages: 1 });
            telegram.addChannel('second', { id: 1020, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('second', 1);
            telegram.failNext('messages.GetHistory', 'AUTH_KEY_UNREGISTERED', 401, 1019);

            await assert.rejects(NewChannelPost.tick(context), (error) => {
                assert.ok(error instanceof context.CancelError);
                assert.match(error.message, /Session String is no longer valid/);
                return true;
            });
            assert.deepStrictEqual(sentIds(), []);
            assert.strictEqual(context.log.callCount, 0);
        });

        it('stops delivering and leaves the state alone once the lock is lost', async function() {

            context = createContext({ channels: '@first, @second' });
            telegram.addChannel('first', { id: 1021, messages: 1 });
            telegram.addChannel('second', { id: 1022, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('first', 1);
            telegram.post('second', 1);
            const lockError = new Error('Cannot extend lock, it has already expired');
            lockError.name = 'LockError';
            let savesAtLoss;
            const extend = sinon.stub();
            extend.onFirstCall().resolves();
            extend.onSecondCall().callsFake(async () => {
                savesAtLoss = context.saveState.callCount;
                throw lockError;
            });
            context.lock = sinon.stub().resolves({ extend, unlock: sinon.stub().resolves() });

            await NewChannelPost.tick(context);
            assert.deepStrictEqual(sent.map(item => item.data.channel_username), ['first']);
            assert.strictEqual(context.saveState.callCount, savesAtLoss);
            assert.strictEqual(context.state.lastIds.second, 1);
            assert.strictEqual(context.log.firstCall.args[0], 'warn');
        });

        it('renews the lock during a long batch', async function() {

            telegram.addChannel('news', { id: 1023, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 60);
            const extend = sinon.stub().resolves();
            context.lock = sinon.stub().resolves({ extend, unlock: sinon.stub().resolves() });

            await NewChannelPost.tick(context);
            assert.strictEqual(sent.length, 60);
            // Once before the channel, then after the 25th and the 50th delivery.
            assert.strictEqual(extend.callCount, 3);
        });

        it('reads the state saved by the previous tick, not the one the tick was created with', async function() {

            telegram.addChannel('news', { id: 1014, messages: 1 });
            await NewChannelPost.start(context);
            telegram.post('news', 2);
            const stale = JSON.parse(JSON.stringify(context.state));
            await NewChannelPost.tick(context);
            // The engine created this tick's context before the previous tick saved its cursor.
            context.state = stale;
            await NewChannelPost.tick(context);

            assert.deepStrictEqual(sentIds(), [2, 3]);
        });

        it('test() emits the newest post without touching the state', async function() {

            telegram.addChannel('news', { id: 1015, messages: 7 });
            await NewChannelPost.test(context);

            assert.deepStrictEqual(sentIds(), [7]);
            assert.strictEqual(context.saveState.callCount, 0);
        });

        it('test() throws for an empty channel', async function() {

            telegram.addChannel('news', { id: 1016, messages: 0 });
            await assert.rejects(NewChannelPost.test(context), /No posts found in @news/);
        });
    });

    describe('formatMessage', function() {

        const channel = { id: '1', accessHash: '2', username: 'news', title: 'News' };

        it('exposes the source of a forward only when it is a channel', function() {

            const source = new Api.Channel({
                id: bigInt(500),
                title: 'Source',
                username: 'source',
                photo: new Api.ChatPhotoEmpty(),
                date: 1
            });
            const fromChannel = lib.formatMessage({
                className: 'Message',
                id: 1,
                date: 1700000000,
                message: 'x',
                fwdFrom: { fromId: new Api.PeerChannel({ channelId: bigInt(500) }), channelPost: 77 }
            }, channel, new Map([['500', source]]));
            const fromUser = lib.formatMessage({
                className: 'Message',
                id: 2,
                date: 1700000000,
                message: 'x',
                fwdFrom: { fromId: new Api.PeerUser({ userId: bigInt(900) }), fromName: 'Private Person' }
            }, channel);

            assert.strictEqual(fromChannel.fwd_from_channel, 'source');
            assert.strictEqual(fromChannel.fwd_from_channel_id, '500');
            assert.strictEqual(fromChannel.fwd_from_message_id, 77);
            assert.strictEqual(fromUser.fwd_from_channel, null);
            assert.strictEqual(fromUser.fwd_from_channel_id, null);
            assert.ok(!JSON.stringify(fromUser).includes('Private Person'));
            assert.ok(!JSON.stringify(fromUser).includes('900'));
        });
    });

    describe('FindChannelMessages', function() {

        const find = async (content) => {

            context.messages = { in: { content } };
            await FindChannelMessages.receive(context);
            return sent[sent.length - 1];
        };

        it('returns the newest messages first, across pages, up to Max Results', async function() {

            telegram.addChannel('news', { id: 2001, messages: 260 });
            const { data, port } = await find({ channel: 'https://t.me/news', maxResults: 250 });

            assert.strictEqual(port, 'out');
            assert.strictEqual(data.count, 250);
            assert.deepStrictEqual(data.result.map(item => item.id), Array.from({ length: 250 }, (_, i) => 260 - i));
            assert.strictEqual(telegram.count('messages.GetHistory'), 3);
        });

        it('defaults to 20 messages', async function() {

            telegram.addChannel('news', { id: 2002, messages: 50 });
            const { data } = await find({ channel: '@news' });

            assert.strictEqual(data.result.length, 20);
            assert.strictEqual(data.result[0].id, 50);
        });

        it('After Message ID returns only newer messages', async function() {

            telegram.addChannel('news', { id: 2003, messages: 30 });
            const { data } = await find({ channel: '@news', minId: 27, maxResults: 100 });

            assert.deepStrictEqual(data.result.map(item => item.id), [30, 29, 28]);
        });

        it('Before Date returns only older messages', async function() {

            telegram.addChannel('news', { id: 2004, messages: 30 });
            const before = new Date((1700000000 + 11 * 60) * 1000).toISOString();
            const { data } = await find({ channel: '@news', offsetDate: before, maxResults: 3 });

            assert.deepStrictEqual(data.result.map(item => item.id), [10, 9, 8]);
        });

        it('sends notFound for an empty result', async function() {

            telegram.addChannel('news', { id: 2005, messages: 5 });
            const { data, port } = await find({ channel: '@news', minId: 5 });

            assert.strictEqual(port, 'notFound');
            assert.deepStrictEqual(data, {});
        });

        it('rejects an invite link and an unknown channel with a clear error', async function() {

            await assert.rejects(find({ channel: 'https://t.me/+AbCdEf' }), /invite link to a private chat/);
            await assert.rejects(find({ channel: '@missing_channel' }), /@missing_channel does not exist/);
        });

        it('a long FLOOD_WAIT is a retryable error, not a CancelError', async function() {

            telegram.addChannel('news', { id: 2006, messages: 5 });
            telegram.failNext('messages.GetHistory', 'FLOOD_WAIT_900', 420);

            await assert.rejects(find({ channel: '@news' }), (error) => {
                assert.ok(!(error instanceof context.CancelError));
                assert.strictEqual(error.floodWait, 900);
                return true;
            });
        });

        it('file output escapes commas, quotes and line breaks', async function() {

            telegram.addChannel('news', { id: 2008, messages: 0 });
            telegram.post('news', 1, { message: 'Results: revenue up 12%, "record" quarter\nMore soon' });
            let csv;
            context.saveFileStream = sinon.stub().callsFake(async (name, buffer) => {
                csv = buffer.toString('utf8');
                return { fileId: 'file-1' };
            });
            const { data } = await find({ channel: '@news', outputType: 'file' });

            assert.deepStrictEqual(data, { fileId: 'file-1' });
            assert.strictEqual(csv.split('\n')[0].split(',').length, 18);
            assert.ok(csv.includes(',"Results: revenue up 12%, ""record"" quarter\nMore soon",'));
            // Absent values are empty fields, not the word "null".
            assert.ok(!csv.includes('null'));
        });

        it('the declared item schema covers exactly the emitted fields', async function() {

            telegram.addChannel('news', { id: 2007, messages: 1 });
            const { data } = await find({ channel: '@news' });

            assert.deepStrictEqual(
                Object.keys(data.result[0]).sort(),
                Object.keys(FindChannelMessages.ITEM_SCHEMA.properties).sort()
            );
        });
    });

    describe('resolveChannel', function() {

        it('takes a channel from the static cache instead of resolving the username', async function() {

            const channel = telegram.addChannel('cached', { id: 3001, messages: 1 });
            context.staticCache.get = sinon.stub().resolves({
                id: '3001',
                accessHash: String(channel.accessHash),
                username: 'cached',
                title: 'cached'
            });
            const ref = await lib.resolveChannel(context, telegram, 'cached');

            assert.strictEqual(ref.id, '3001');
            assert.strictEqual(telegram.count('contacts.ResolveUsername'), 0);
        });

        it('stores a resolved channel in the static cache and survives a broken cache', async function() {

            telegram.addChannel('fresh', { id: 3002, messages: 1 });
            context.staticCache.get = sinon.stub().rejects(new Error('Missing static cache'));
            context.staticCache.set = sinon.stub().rejects(new Error('Missing static cache'));
            const ref = await lib.resolveChannel(context, telegram, 'fresh');

            assert.strictEqual(ref.id, '3002');
            assert.strictEqual(context.staticCache.set.callCount, 1);
            await lib.resolveChannel(context, telegram, 'fresh');
            assert.strictEqual(telegram.count('contacts.ResolveUsername'), 1);
        });
    });

    describe('GetChannel', function() {

        it('returns the channel details with flags from the full channel', async function() {

            telegram.addChannel('news', { id: 4001, title: 'News', messages: 1, flags: { verified: true, broadcast: true } });
            context.messages = { in: { content: { channel: '@news' } } };
            await GetChannel.receive(context);

            assert.deepStrictEqual(sent[0].data, {
                id: '4001',
                username: 'news',
                title: 'News',
                description: 'About the channel',
                url: 'https://t.me/news',
                type: 'channel',
                subscribers_count: 1234,
                is_public: true,
                is_verified: true,
                is_scam: false,
                is_fake: false,
                is_restricted: false,
                restriction_reason: null,
                created_at: new Date(1500000000 * 1000).toISOString(),
                linked_chat_id: '777'
            });
        });
    });

    describe('auth', function() {

        // The engine's auth context: fields directly on the context, InvalidTokenError, no
        // CancelError and no `auth` object.
        class InvalidTokenError extends Error {}
        const authContext = () => ({ apiId: '1', apiHash: 'hash', session: 'session', InvalidTokenError });
        const definition = auth.definition();

        it('validates a user session and builds the profile without the phone number', async function() {

            telegram.me = new Api.User({ id: bigInt(42), firstName: 'Jana', lastName: 'N', username: 'jana', phone: '420123456789' });

            assert.strictEqual(await definition.validate(authContext()), true);
            const profile = await definition.requestProfileInfo(authContext());
            assert.deepStrictEqual(profile, {
                accountName: '@jana',
                id: '42',
                username: 'jana',
                firstName: 'Jana',
                lastName: 'N'
            });
            assert.deepStrictEqual(lib.getClient.firstCall.args[0].auth, { apiId: '1', apiHash: 'hash', session: 'session' });
        });

        it('rejects a bot session as an invalid token with a clear message', async function() {

            telegram.me = new Api.User({ id: bigInt(43), bot: true, firstName: 'Bot' });

            await assert.rejects(definition.validate(authContext()), (error) => {
                assert.ok(error instanceof InvalidTokenError);
                assert.match(error.message, /belongs to a bot/);
                return true;
            });
        });

        it('reports a revoked session as an invalid token', async function() {

            telegram.failNext('users.GetUsers', 'AUTH_KEY_UNREGISTERED', 401);

            await assert.rejects(definition.validate(authContext()), (error) => {
                assert.ok(error instanceof InvalidTokenError);
                assert.match(error.message, /Session String is no longer valid \(AUTH_KEY_UNREGISTERED\)/);
                return true;
            });
        });

        it('does not invalidate the account on a FLOOD_WAIT', async function() {

            telegram.failNext('users.GetUsers', 'FLOOD_WAIT_300', 420);

            await assert.rejects(definition.validate(authContext()), (error) => {
                assert.ok(!(error instanceof InvalidTokenError));
                assert.match(error.message, /FLOOD_WAIT/);
                return true;
            });
        });
    });
});
