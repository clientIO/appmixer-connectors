'use strict';

const lib = require('../lib');

// A tick reads at most this many posts per channel. A larger backlog (after an outage) is
// read on the following ticks, oldest first, so nothing is skipped.
const MAX_POSTS_PER_TICK = 200;

// The engine sends a tick every minute whether or not the previous one has finished, and a
// tick that waits out a FLOOD_WAIT or reads a backlog can take longer than that. Two ticks
// reading from the same cursor would emit every post twice, so a tick runs under a lock and
// a tick that finds it taken is skipped - the running one delivers the posts.
const TICK_LOCK_TTL_MS = 5 * 60 * 1000;

// The lease is renewed before every channel and after this many deliveries, so a long
// batch cannot outlive it.
const RENEW_LOCK_EVERY = 25;

const acquireTickLock = async (context) => {

    if (typeof context.lock !== 'function') {
        return { lock: null, busy: false };
    }

    try {
        const lock = await context.lock(`telegram-user-new-channel-post:${context.componentId}`, {
            ttl: TICK_LOCK_TTL_MS,
            retryDelay: 200,
            maxRetryCount: 1
        });
        return { lock, busy: false };
    } catch (error) {
        // redlock gives up with a LockError when another tick holds the lock: that tick
        // delivers the posts. Any other failure means the lock cannot be relied on, and
        // polling without it could emit every post twice. The tick fails instead and the
        // next one tries again - the cursor is untouched, so nothing is lost.
        if (error && error.name === 'LockError') {
            return { lock: null, busy: true };
        }
        throw error;
    }
};

/**
 * Polls messages.getHistory with min_id = last seen post id for every watched channel.
 * Updates are not used: they only arrive for joined channels and are lost while the
 * connection is down, whereas min_id polling also catches up after a restart. The channels
 * are never joined.
 *
 * State: `channels` maps the lower-cased username to the channel reference resolved when
 * the flow started (id + access hash), `lastIds` maps it to the id of the last post that
 * was emitted. Keeping the reference means a running flow never calls
 * contacts.resolveUsername again, which is the call Telegram flood-limits the hardest.
 */
module.exports = {

    async start(context) {

        const usernames = lib.parseChannelList(context, context.properties.channels);

        if (!usernames.length) {
            throw new context.CancelError('At least one channel is required!');
        }

        const client = await lib.getClient(context);
        const channels = {};
        const lastIds = {};

        // Fails the flow start with a clear error for a private, misspelled or
        // non-channel username, and sets the baseline so only posts published from now
        // on are emitted.
        for (const username of usernames) {
            const key = username.toLowerCase();
            const channel = await lib.resolveChannel(context, client, username);
            const { messages, channel: current } = await lib.getHistory(context, client, channel, { limit: 1 });
            channels[key] = current;
            lastIds[key] = messages.length ? messages[0].id : 0;
        }

        return context.saveState({ channels, lastIds });
    },

    async tick(context) {

        const usernames = lib.parseChannelList(context, context.properties.channels);
        const { lock, busy } = await acquireTickLock(context);

        if (busy) {
            return;
        }

        try {
            await poll(context, usernames, lock);
        } finally {
            if (lock) {
                await lock.unlock().catch(() => {});
            }
        }
    },

    // Flow Test Mode: emit the newest post of the first channel.
    async test(context) {

        const [username] = lib.parseChannelList(context, context.properties.channels);

        if (!username) {
            throw new context.CancelError('At least one channel is required!');
        }

        const client = await lib.getClient(context);
        const channel = await lib.resolveChannel(context, client, username);
        const { messages, chats, channel: current } = await lib.getHistory(context, client, channel, { limit: 10 });
        const post = messages.map(message => lib.formatMessage(message, current, chats)).find(Boolean);

        if (!post) {
            throw new context.CancelError(
                `No posts found in @${username}. The channel may be empty or restricted in your region.`
            );
        }

        return context.sendJson(post, 'out');
    }
};

const poll = async (context, usernames, lock) => {

    const client = await lib.getClient(context);
    // Read the state again now that the lock is held: the state this tick was created with
    // may predate the cursor a tick that has just finished saved.
    const loaded = typeof context.loadState === 'function' ? await context.loadState() : context.state;
    const previous = loaded || context.state || {};
    // Only channels still in the configuration are kept.
    const channels = {};
    const lastIds = {};
    usernames.forEach(username => {
        const key = username.toLowerCase();
        if (previous.channels && previous.channels[key]) {
            channels[key] = previous.channels[key];
        }
        if (previous.lastIds && previous.lastIds[key] !== undefined) {
            lastIds[key] = previous.lastIds[key];
        }
    });

    // Once the lease is lost another tick may be running. This one must then neither deliver
    // nor write state: its snapshot would overwrite the cursor the other tick has saved.
    let leaseLost = false;
    const renewLease = async () => {
        if (!lock) {
            return;
        }
        try {
            await lock.extend(TICK_LOCK_TTL_MS);
        } catch (error) {
            leaseLost = true;
            throw error;
        }
    };
    const saveProgress = async () => {
        if (!leaseLost) {
            await context.saveState({ channels, lastIds });
        }
    };

    for (const username of usernames) {
        const key = username.toLowerCase();

        try {
            await renewLease();

            if (!channels[key]) {
                channels[key] = await lib.resolveChannel(context, client, username);
            }

            if (lastIds[key] === undefined) {
                const { messages, channel } = await lib.getHistory(context, client, channels[key], { limit: 1 });
                channels[key] = channel;
                lastIds[key] = messages.length ? messages[0].id : 0;
                continue;
            }

            const { messages, chats, lastId, channel } = await lib.getMessagesSince(
                context,
                client,
                channels[key],
                lastIds[key],
                MAX_POSTS_PER_TICK
            );

            channels[key] = channel;

            let delivered = 0;

            for (const message of messages) {
                const post = lib.formatMessage(message, channel, chats);
                if (post) {
                    await context.sendJson(post, 'out');
                }
                lastIds[key] = message.id;
                if (post) {
                    // Saved after every delivery: a failure, or a worker that dies in the
                    // middle of a batch, repeats at most the post it was sending.
                    await saveProgress();
                    delivered += 1;
                    if (delivered % RENEW_LOCK_EVERY === 0) {
                        await renewLease();
                    }
                }
            }

            lastIds[key] = Math.max(lastIds[key], lastId);
        } catch (error) {
            if (leaseLost) {
                await context.log('warn', {
                    message: 'The tick took too long and lost its lock, the rest is read on the next tick.',
                    channel: username
                });
                break;
            }
            if (error.floodWait) {
                // Do not fail the flow - the remaining channels are read on the next tick.
                await context.log('warn', {
                    message: 'Telegram FLOOD_WAIT, postponing to the next tick.',
                    seconds: error.floodWait,
                    channel: username
                });
                break;
            }
            if (error instanceof context.CancelError && error.channelError) {
                // One channel going private or being deleted must not stop the others. A
                // revoked session or wrong API credentials are not channel errors: they
                // fail the tick, there is no point in trying the remaining channels.
                await context.log('error', { message: error.message, channel: username });
                continue;
            }
            throw error;
        } finally {
            await saveProgress();
        }
    }
};
