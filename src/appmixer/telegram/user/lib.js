'use strict';

const crypto = require('crypto');
const bigInt = require('big-integer');
const { TelegramClient, Api } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const { Logger } = require('teleproto/extensions/Logger');
const coreLib = require('../lib');

// teleproto sleeps through a FLOOD_WAIT on its own when Telegram asks for at most this many
// seconds. Longer waits surface as a retryable error instead of blocking the engine.
const FLOOD_SLEEP_THRESHOLD = 60;

// A guard, so an engine worker never waits on Telegram indefinitely: the client keeps
// reconnecting and a request waits for its answer for as long as it takes. A request may
// legitimately take as long as the FLOOD_WAIT teleproto sleeps through, hence the longer
// request deadline.
const CONNECT_TIMEOUT_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = (FLOOD_SLEEP_THRESHOLD + 60) * 1000;

// One MTProto connection per account and engine process, reused by every component and
// trigger of that account. Dropped after a quiet period so idle accounts hold no socket.
const IDLE_DISCONNECT_MS = 5 * 60 * 1000;

// contacts.resolveUsername is the most aggressively flood-limited call a user account can
// make: a few hundred calls a day earn a FLOOD_WAIT of many hours. A channel's id and access
// hash never change for an account, so a resolved channel is kept for a day - in this process
// and in the static cache shared by all engine processes - and the trigger keeps the channels
// it watches in its own state, so a running flow does not resolve usernames at all.
const RESOLVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// messages.getHistory returns at most 100 messages per call.
const PAGE_SIZE = 100;

const clients = new Map();
const resolved = new Map();

// Errors that mean the session string no longer authorizes this account.
const SESSION_ERRORS = [
    'AUTH_KEY_UNREGISTERED',
    'AUTH_KEY_INVALID',
    'AUTH_KEY_DUPLICATED',
    'SESSION_REVOKED',
    'SESSION_EXPIRED',
    'USER_DEACTIVATED',
    'USER_DEACTIVATED_BAN'
];

const NOT_FOUND_ERRORS = ['USERNAME_NOT_OCCUPIED', 'USERNAME_INVALID'];
const PRIVATE_ERRORS = ['CHANNEL_PRIVATE', 'CHANNEL_INVALID', 'CHANNEL_PUBLIC_GROUP_NA'];

const MEDIA_TYPES = {
    MessageMediaPhoto: 'photo',
    MessageMediaWebPage: 'webpage',
    MessageMediaPoll: 'poll',
    MessageMediaGeo: 'geo',
    MessageMediaGeoLive: 'geo_live',
    MessageMediaVenue: 'venue',
    MessageMediaContact: 'contact',
    MessageMediaDice: 'dice',
    MessageMediaGame: 'game',
    MessageMediaInvoice: 'invoice',
    MessageMediaStory: 'story',
    MessageMediaGiveaway: 'giveaway',
    MessageMediaPaidMedia: 'paid_media'
};

module.exports = {

    PAGE_SIZE,

    sendArrayOutput: coreLib.sendArrayOutput,
    getOutputPortOptions: coreLib.getOutputPortOptions,

    /**
     * @param {object} auth - context.auth, or the context itself inside auth.js
     * @returns {{apiId: number, apiHash: string, session: string}}
     */
    getCredentials(auth = {}) {

        return {
            apiId: parseInt(String(auth.apiId || '').trim(), 10),
            apiHash: String(auth.apiHash || '').trim(),
            session: String(auth.session || '').trim()
        };
    },

    /**
     * Connected client for the account, shared across calls in this process.
     * @param {object} context
     * @returns {Promise<TelegramClient>}
     */
    async getClient(context) {

        const { apiId, apiHash, session } = this.getCredentials(context.auth || context);

        if (!apiId || !apiHash || !session) {
            throw new context.CancelError('API ID, API Hash and Session String are required!');
        }

        const key = crypto.createHash('sha256').update(`${apiId}:${apiHash}:${session}`).digest('hex');
        let entry = clients.get(key);

        if (!entry) {
            let client;
            try {
                client = new TelegramClient(new StringSession(session), apiId, apiHash, {
                    connectionRetries: 3,
                    autoReconnect: true,
                    floodSleepThreshold: FLOOD_SLEEP_THRESHOLD,
                    // The components address channels by the id and access hash they keep
                    // themselves, and never use the account's updates (they only arrive for
                    // joined channels and are lost while offline). teleproto cannot switch its
                    // update handling off, so at least nothing from it is kept in memory.
                    entityCache: false,
                    // Errors only - teleproto writes to stdout, which is the engine's log.
                    baseLogger: new Logger('error')
                });
            } catch (error) {
                throw new context.CancelError(
                    'Invalid Session String. Generate a new one for this API ID.'
                );
            }
            entry = { key, client, ready: null, timer: null };
            clients.set(key, entry);
        }

        if (!entry.client.connected) {
            entry.ready = entry.ready || withTimeout(
                entry.client.connect(),
                CONNECT_TIMEOUT_MS,
                `Telegram did not answer within ${CONNECT_TIMEOUT_MS / 1000} seconds while connecting.`
            ).finally(() => {
                entry.ready = null;
            });
            try {
                await entry.ready;
            } catch (error) {
                this.dropClient(entry.client, key);
                throw this.normalizeError(context, error, 'connect');
            }
        }

        entry.client.appmixerKey = key;
        this.touchClient(entry.client);
        return entry.client;
    },

    /**
     * Restart the idle countdown of a shared client. Called for every request, before and
     * after it, so a long read (many pages or channels) keeps its connection and the
     * countdown only runs while the client is not in use.
     * @param {TelegramClient} client
     */
    touchClient(client) {

        const key = client && client.appmixerKey;
        const entry = clients.get(key);

        if (!entry || entry.client !== client) {
            return;
        }

        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => this.dropClient(client, key), IDLE_DISCONNECT_MS);
        if (entry.timer.unref) {
            entry.timer.unref();
        }
    },

    /**
     * client.invoke with Telegram's RPC errors turned into Appmixer errors.
     * @param {object} context
     * @param {TelegramClient} client
     * @param {object} request - an Api.* request instance
     * @param {string} target - what the request is about, used in error messages
     * @returns {Promise<*>}
     */
    async invoke(context, client, request, target) {

        this.touchClient(client);

        try {
            const result = await withTimeout(
                client.invoke(request),
                REQUEST_TIMEOUT_MS,
                `Telegram did not answer the request for ${target} within ${REQUEST_TIMEOUT_MS / 1000} seconds.`
            );
            this.touchClient(client);
            return result;
        } catch (error) {
            if (error.telegramTimeout) {
                // The connection is most likely dead; the next call opens a new one.
                this.dropClient(client, client.appmixerKey);
            }
            throw this.normalizeError(context, error, target);
        }
    },

    /**
     * Forget a client and close its connection.
     * @param {TelegramClient} client
     * @param {string} key
     */
    dropClient(client, key) {

        const entry = clients.get(key);

        if (entry && entry.client === client) {
            clearTimeout(entry.timer);
            clients.delete(key);
        }
        if (client && typeof client.destroy === 'function') {
            client.destroy().catch(() => {});
        }
    },

    /**
     * FLOOD_WAIT and transport failures stay plain Errors so Appmixer retries the message
     * later; everything the user has to fix becomes a CancelError.
     * @param {object} context
     * @param {Error} error
     * @param {string} target
     * @returns {Error}
     */
    normalizeError(context, error, target) {

        if (error instanceof context.CancelError) {
            return error;
        }

        const code = error && error.errorMessage;

        if (code && /^FLOOD/.test(code) && typeof error.seconds === 'number') {
            const flood = new Error(
                `Telegram asked to wait ${error.seconds} seconds before the next request (FLOOD_WAIT). `
                + 'The message will be retried.'
            );
            flood.floodWait = error.seconds;
            return flood;
        }

        if (NOT_FOUND_ERRORS.includes(code)) {
            return channelError(context, `Channel ${target} does not exist. Check the username.`);
        }

        if (PRIVATE_ERRORS.includes(code)) {
            return channelError(
                context,
                `Channel ${target} is private or not accessible to this account. Only public channels can be read without joining them.`
            );
        }

        if (SESSION_ERRORS.includes(code)) {
            return new context.CancelError(
                `The Session String is no longer valid (${code}). Generate a new one and reconnect the account.`
            );
        }

        if (code === 'API_ID_INVALID' || code === 'API_ID_PUBLISHED_FLOOD') {
            return new context.CancelError(`Invalid API ID / API Hash (${code}). Copy them from my.telegram.org.`);
        }

        if (code) {
            const message = `Telegram request for ${target} failed: ${code}.`;
            return error.code >= 400 && error.code < 500 ? new context.CancelError(message) : new Error(message);
        }

        return error instanceof Error ? error : new Error(String(error));
    },

    /**
     * Accepts "@name", "name", "https://t.me/name", "t.me/s/name" or a post link
     * "https://t.me/name/123" and returns the bare username.
     * @param {object} context
     * @param {string} input
     * @returns {string}
     */
    normalizeUsername(context, input) {

        const value = String(input || '').trim();

        if (/(?:t|telegram)\.(?:me|dog)\/(?:\+|joinchat\/)/i.test(value)) {
            throw new context.CancelError(
                `"${value}" is an invite link to a private chat. Only public channels, addressed by @username, are supported.`
            );
        }

        const link = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.(?:me|dog)\/(?:s\/)?([^/?#]+)/i);
        const username = (link ? link[1] : value).replace(/^@/, '');

        if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username)) {
            throw new context.CancelError(`"${value}" is not a valid public channel username.`);
        }

        return username;
    },

    /**
     * Comma- or newline-separated channel list, normalized and de-duplicated.
     * @param {object} context
     * @param {string} input
     * @returns {string[]}
     */
    parseChannelList(context, input) {

        const usernames = String(input || '')
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(item => this.normalizeUsername(context, item));

        return [...new Map(usernames.map(name => [name.toLowerCase(), name])).values()];
    },

    /**
     * The part of a channel that is needed to address it and to label its messages. Plain
     * data, so it can be kept in the trigger state and in the static cache.
     * @param {object} channel - Api.Channel or a channel reference
     * @returns {{id: string, accessHash: string, username: string|null, title: string}}
     */
    channelRef(channel) {

        return {
            id: String(channel.id),
            accessHash: String(channel.accessHash),
            username: this.channelUsername(channel),
            title: channel.title
        };
    },

    /**
     * Resolve a public username to a channel reference without joining the channel.
     * contacts.resolveUsername is called only when neither this process nor the static
     * cache knows the channel.
     * @param {object} context
     * @param {TelegramClient} client
     * @param {string} username - bare username
     * @returns {Promise<{id: string, accessHash: string, username: string|null, title: string}>}
     */
    async resolveChannel(context, client, username) {

        const cacheKey = `telegram-user:channel:${client.appmixerKey}:${username.toLowerCase()}`;
        const cached = resolved.get(cacheKey);

        if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL_MS) {
            return cached.channel;
        }

        const shared = await staticCacheGet(context, cacheKey);

        if (shared && shared.id && shared.accessHash) {
            resolved.set(cacheKey, { channel: shared, at: Date.now() });
            return shared;
        }

        const ref = this.channelRef(await this.resolveUsername(context, client, username));

        resolved.set(cacheKey, { channel: ref, at: Date.now() });
        await staticCacheSet(context, cacheKey, ref, RESOLVE_CACHE_TTL_MS);
        return ref;
    },

    /**
     * One contacts.resolveUsername call. Use resolveChannel instead, which caches.
     * @param {object} context
     * @param {TelegramClient} client
     * @param {string} username - bare username
     * @returns {Promise<object>} Api.Channel
     */
    async resolveUsername(context, client, username) {

        const target = `@${username}`;
        const result = await this.invoke(context, client, new Api.contacts.ResolveUsername({ username }), target);
        const peer = result.peer;

        if (!peer || peer.className !== 'PeerChannel') {
            throw channelError(context, `${target} is a user or a bot, not a channel.`);
        }

        const channel = (result.chats || []).find(chat => String(chat.id) === String(peer.channelId));

        if (!channel || channel.className !== 'Channel') {
            throw channelError(
                context,
                `Channel ${target} is private or not accessible to this account (it may be banned or restricted).`
            );
        }

        return channel;
    },

    inputPeer(channel) {

        return new Api.InputPeerChannel({
            channelId: bigInt(String(channel.id)),
            accessHash: bigInt(String(channel.accessHash))
        });
    },

    inputChannel(channel) {

        return new Api.InputChannel({
            channelId: bigInt(String(channel.id)),
            accessHash: bigInt(String(channel.accessHash))
        });
    },

    /**
     * One messages.getHistory call. Works on public channels the account has not joined.
     * Telegram always returns the page newest first.
     * @param {object} context
     * @param {TelegramClient} client
     * @param {object} channel
     * @param {object} params - offsetId, offsetDate, addOffset, limit, maxId, minId
     * @returns {Promise<{messages: object[], chats: Map<string, object>, channel: object}>}
     *   `channel` is the reference with the username and title Telegram reports right now,
     *   so a channel that was renamed since it was resolved is labelled correctly.
     */
    async getHistory(context, client, channel, params = {}) {

        const result = await this.invoke(context, client, new Api.messages.GetHistory({
            peer: this.inputPeer(channel),
            offsetId: params.offsetId || 0,
            offsetDate: params.offsetDate || 0,
            addOffset: params.addOffset || 0,
            limit: params.limit || PAGE_SIZE,
            maxId: params.maxId || 0,
            minId: params.minId || 0,
            hash: bigInt.zero
        }), this.channelLabel(channel));

        const chats = new Map((result.chats || []).map(chat => [String(chat.id), chat]));
        const current = chats.get(String(channel.id));

        return {
            messages: result.messages || [],
            chats,
            channel: current && current.className === 'Channel' && current.accessHash !== undefined
                ? this.channelRef(current)
                : channel
        };
    },

    /**
     * Messages newer than `sinceId`, oldest first, at most `max` of them. Pages forward
     * (offset_id = cursor + 1, add_offset = -limit) so a backlog after an outage is read in
     * order and the rest is picked up by the next call instead of being skipped.
     * @param {object} context
     * @param {TelegramClient} client
     * @param {object} channel
     * @param {number} sinceId
     * @param {number} max
     * @returns {Promise<{messages: object[], chats: Map<string, object>, lastId: number, channel: object}>}
     */
    async getMessagesSince(context, client, channel, sinceId, max) {

        const messages = [];
        const chats = new Map();
        let cursor = sinceId;
        let current = channel;

        while (messages.length < max) {
            const limit = Math.min(PAGE_SIZE, max - messages.length);
            const page = await this.getHistory(context, client, channel, {
                offsetId: cursor + 1,
                addOffset: -limit,
                limit,
                minId: cursor
            });
            const newer = page.messages
                .filter(message => message.id > cursor)
                .sort((a, b) => a.id - b.id);

            current = page.channel;

            if (!newer.length) {
                break;
            }

            page.chats.forEach((chat, id) => chats.set(id, chat));
            messages.push(...newer);
            cursor = newer[newer.length - 1].id;

            if (page.messages.length < limit) {
                break;
            }
        }

        return { messages, chats, lastId: cursor, channel: current };
    },

    channelUsername(channel) {

        if (channel.username) {
            return channel.username;
        }
        const active = (channel.usernames || []).find(item => item.active);
        return active ? active.username : null;
    },

    channelLabel(channel) {

        const username = this.channelUsername(channel);
        return username ? `@${username}` : `"${channel.title}"`;
    },

    mediaType(media) {

        if (!media || media.className === 'MessageMediaEmpty') {
            return null;
        }

        if (media.className === 'MessageMediaDocument') {
            const attributes = (media.document && media.document.attributes) || [];
            const has = className => attributes.find(attribute => attribute.className === className);

            if (has('DocumentAttributeSticker')) return 'sticker';
            if (has('DocumentAttributeAnimated')) return 'gif';
            const video = has('DocumentAttributeVideo');
            if (video) return video.roundMessage ? 'video_note' : 'video';
            const audio = has('DocumentAttributeAudio');
            if (audio) return audio.voice ? 'voice' : 'audio';
            return 'document';
        }

        return MEDIA_TYPES[media.className] || media.className.replace(/^MessageMedia/, '').toLowerCase();
    },

    /**
     * Flatten a teleproto Message into the shape the components emit. Service messages
     * ("channel created", "message pinned") and empty slots return null.
     * The forward source is exposed only when it is a channel - never a private user.
     * @param {object} message
     * @param {object} channel
     * @param {Map<string, object>} chats - chats returned alongside the message
     * @returns {object|null}
     */
    formatMessage(message, channel, chats = new Map()) {

        if (!message || message.className !== 'Message') {
            return null;
        }

        const username = this.channelUsername(channel);
        const fwdFrom = message.fwdFrom || null;
        const fwdPeer = fwdFrom && fwdFrom.fromId;
        const fwdChannelId = fwdPeer && fwdPeer.className === 'PeerChannel' ? String(fwdPeer.channelId) : null;
        const fwdChannel = fwdChannelId ? chats.get(fwdChannelId) : null;

        return {
            id: message.id,
            date: toIso(message.date),
            text: message.message || '',
            url: username
                ? `https://t.me/${username}/${message.id}`
                : `https://t.me/c/${channel.id}/${message.id}`,
            views: numberOrNull(message.views),
            forwards: numberOrNull(message.forwards),
            replies: message.replies ? numberOrNull(message.replies.replies) : null,
            media_type: this.mediaType(message.media),
            fwd_from_channel: fwdChannel ? this.channelUsername(fwdChannel) : null,
            fwd_from_channel_id: fwdChannelId,
            fwd_from_message_id: fwdChannelId ? numberOrNull(fwdFrom.channelPost) : null,
            reply_to_id: message.replyTo ? numberOrNull(message.replyTo.replyToMsgId) : null,
            grouped_id: message.groupedId ? String(message.groupedId) : null,
            edit_date: message.editDate ? toIso(message.editDate) : null,
            post_author: message.postAuthor || null,
            channel_id: String(channel.id),
            channel_username: username,
            channel_title: channel.title
        };
    }
};

const toIso = (seconds) => new Date(Number(seconds) * 1000).toISOString();

// A CancelError about one channel (unknown, private, not a channel), as opposed to one about
// the account (revoked session, wrong API credentials). The trigger skips a channel for the
// former and fails for the latter.
const channelError = (context, message) => {

    const error = new context.CancelError(message);
    error.channelError = true;
    return error;
};

// Rejects with a plain (retryable) Error when the promise does not settle in time.
const withTimeout = (promise, ms, message) => {

    let timer;
    const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            const error = new Error(message);
            error.telegramTimeout = true;
            reject(error);
        }, ms);
    });

    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};

// The static cache only saves resolveUsername calls. It must never fail a component: it is
// absent in the auth context and in the CLI test harness.
const staticCacheGet = async (context, key) => {

    try {
        return context.staticCache ? await context.staticCache.get(key) : null;
    } catch (error) {
        return null;
    }
};

const staticCacheSet = async (context, key, value, ttl) => {

    try {
        if (context.staticCache) {
            await context.staticCache.set(key, value, ttl);
        }
    } catch (error) {
        // Not cached - the next call resolves the username again.
    }
};

const numberOrNull = (value) => (value === undefined || value === null ? null : Number(value));
