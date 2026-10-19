'use strict';

const { randomUUID } = require('crypto');

// Everything related to the Each "sequential" mode lives here. A plain Each emits all items in one
// tight loop, so when the loop body has a variable latency the items overtake each other and leave
// the body in a different order. Each cannot see when the body is done with an item - sendJson only
// enqueues - so a delay between items merely spaces them out, it does not order them.
//
// In sequential mode Each emits ONE item and waits. The ContinueEach component, placed at the end of
// the loop body, acknowledges the item by calling the webhook URL of this component directly (the
// engine's POST /flows/{flowId}/components/{componentId} endpoint, through context.callAppmixer),
// which wakes this component up on its webhook port to emit the next item. The engine restores the
// scope of the message that started the loop for that webhook delivery (see getWebhookQuery), so
// every item continues the original branch and upstream variables stay resolvable in the loop body.
//
// Everything is kept in engine-provided state, no plugin is involved:
//   - component state `<id>`        the loop cursor: the item in flight, its timeout, loop metadata
//                                   and the values collected by ContinueEach so far
//   - component state `items:<id>`  the parked list (the webhook delivery does not carry `in`)
//   - flow state `each:<id>`        where ContinueEach finds the webhook target of this loop
//
// An item that is never acknowledged (the body failed, or a Condition filtered the item out before
// ContinueEach) is given up on after the item timeout, so the loop cannot hang forever.

const DEFAULT_ITEM_TIMEOUT = 300;
// The engine silently rounds any context.setTimeout below one minute up to one minute, so a smaller
// item timeout would not do what it says.
const MIN_ITEM_TIMEOUT = 60;

const itemsKey = id => `items:${id}`;
// Read by ContinueEach - keep the two in sync.
const targetKey = id => `each:${id}`;
const lockName = id => `each-sequential:${id}`;

/**
 * Normalize and validate the item timeout (seconds).
 * @param {Object} context - Appmixer context
 * @param {*} rawItemTimeout
 * @returns {number}
 */
function parseItemTimeout(context, rawItemTimeout) {

    const itemTimeout = (rawItemTimeout == null || rawItemTimeout === '')
        ? DEFAULT_ITEM_TIMEOUT
        : Number(rawItemTimeout);
    if (!Number.isFinite(itemTimeout) || itemTimeout < MIN_ITEM_TIMEOUT) {
        throw new context.CancelError(
            `Property 'itemTimeout' must be a number of seconds, at least ${MIN_ITEM_TIMEOUT}.`
        );
    }
    return itemTimeout;
}

/**
 * The correlation query parameters of the message that started the loop. The engine needs all three
 * (correlationId, correlationInPort, messageId) to restore that message's scope on a webhook delivery.
 * @param {Object} context - Appmixer context
 * @returns {Object}
 */
function getWebhookQuery(context) {

    const url = new URL(context.getWebhookUrl({ inPortName: 'in' }));
    const query = {};
    ['correlationId', 'correlationInPort', 'messageId'].forEach(name => {
        if (url.searchParams.has(name)) {
            query[name] = url.searchParams.get(name);
        }
    });
    return query;
}

/**
 * Emit one item and record it as the item in flight. Must be called with the loop lock held: a fast
 * loop body can acknowledge the item before the state is written. Every attempt gets its own timeout
 * token: when sendJson or stateSet fails after the timeout was set, the retry sets another one, and
 * the orphaned timeout of the failed attempt must not be able to move the retried item on.
 * @param {Object} context - Appmixer context
 * @param {string} id - Loop id (the context.id of the `in` message)
 * @param {Object} cursor - Loop metadata + collected results (see handleStart)
 * @param {number} index
 * @param {*} value
 */
async function sendItem(context, id, cursor, index, value) {

    const { count, correlationId, itemTimeout } = cursor;
    const timeoutToken = randomUUID();
    const timeoutId = await context.setTimeout({ id, sequential: true, index, timeoutToken }, itemTimeout * 1000);
    await context.sendJson({ index, value, count, correlationId }, 'item');
    // At-least-once: a crash between sendJson and stateSet re-sends this item on re-delivery rather
    // than losing it.
    // eslint-disable-next-line no-unused-vars
    const { acked, ...loop } = cursor;
    await context.stateSet(id, { ...loop, index, timeoutId, timeoutToken });
}

/**
 * Run `fn` with the loop lock held.
 * @param {Object} context - Appmixer context
 * @param {string} id
 * @param {Function} fn
 */
async function withLock(context, id, fn) {

    let lock = null;
    try {
        lock = await context.lock(lockName(id));
        return await fn();
    } finally {
        lock?.unlock();
    }
}

/**
 * Forget everything about a finished loop.
 * @param {Object} context - Appmixer context
 * @param {string} id
 */
async function cleanup(context, id) {

    await context.stateUnset(itemsKey(id));
    await context.flow.stateUnset(targetKey(id));
    // The cursor goes last: it is what marks the loop as running.
    return context.stateUnset(id);
}

/**
 * Handle the `in` message: park the list and emit the first item only.
 * @param {Object} context - Appmixer context
 * @param {Object} params
 * @param {Array} params.list - The full list to iterate
 * @param {string} params.correlationId - Correlation ID for this Each execution (the retry-stable context.id)
 * @param {number} params.count - Total count of items
 * @param {number} params.delay - Extra delay before each next item in milliseconds (0 = none)
 * @param {*} params.itemTimeout - Raw item timeout in seconds
 */
async function handleStart(context, { list, correlationId, count, delay, itemTimeout: rawItemTimeout }) {

    const id = context.id;
    const itemTimeout = parseItemTimeout(context, rawItemTimeout);

    if (count === 0) {
        return context.sendJson({ count, correlationId, result: [] }, 'done');
    }

    let lock = null;
    try {
        lock = await context.lock(lockName(id));

        if (await context.stateGet(id)) {
            // The engine re-delivered `in` for a loop that is already running. The acknowledgement /
            // timeout chain drives it from here; starting over would re-send every item.
            return;
        }

        await context.stateSet(itemsKey(id), list);
        // ContinueEach only knows the loop id (the Correlation ID mapped to it), so this is how it
        // finds which component to wake up and with which correlation, before the first item goes out.
        await context.flow.stateSet(targetKey(id), {
            componentId: context.componentId,
            webhookQuery: getWebhookQuery(context)
        });

        await sendItem(context, id, { count, correlationId, delay, itemTimeout, results: [] }, 0, list[0]);
    } finally {
        lock?.unlock();
    }
}

/**
 * Item `doneIndex` is finished: emit the next item, or `done` after the last one. Must be called with
 * the loop lock held, with `current` (the cursor) already carrying the values collected for the item.
 * @param {Object} context - Appmixer context
 * @param {string} id
 * @param {Object} current - The cursor
 * @param {number} doneIndex
 */
async function emitNext(context, id, current, doneIndex) {

    if (current.timeoutId) {
        await context.clearTimeout(current.timeoutId);
    }

    const { count, correlationId, results = [] } = current;
    const nextIndex = doneIndex + 1;

    if (nextIndex >= count) {
        // `done` first, clean up after: a crash in between repeats `done` instead of losing it.
        await context.sendJson({ count, correlationId, result: results }, 'done');
        return cleanup(context, id);
    }

    const items = await context.stateGet(itemsKey(id));
    if (!Array.isArray(items)) {
        await context.log({ step: 'no-data', message: 'Each sequential: stored list is missing, nothing to continue.' });
        return cleanup(context, id);
    }

    return sendItem(context, id, current, nextIndex, items[nextIndex]);
}

/**
 * Item `doneIndex` was acknowledged by ContinueEach: record its values and emit the next item (after
 * the delay, if any), or `done` after the last one. An acknowledgement that does not refer to the
 * item in flight is ignored: a duplicate (a loop body that fans out into two ContinueEach, an engine
 * re-delivery, a second acknowledgement during the delay) or a late one for an item that timed out.
 * @param {Object} context - Appmixer context
 * @param {string} id
 * @param {number} doneIndex
 * @param {Object} entry - The fields ContinueEach added for this item
 */
async function acknowledge(context, id, doneIndex, entry) {

    const isAwaitingAck = cursor => cursor && cursor.index === doneIndex && !cursor.acked;

    // Cheap check before taking the lock; repeated under it.
    if (!isAwaitingAck(await context.stateGet(id))) {
        return;
    }

    const delay = await withLock(context, id, async () => {
        const current = await context.stateGet(id);
        if (!isAwaitingAck(current)) {
            return 0;
        }
        // Items finish strictly in order, so the entry of item N is always the (N+1)th one.
        const cursor = { ...current, results: (current.results || []).concat([entry]) };
        if (!cursor.delay || doneIndex + 1 >= cursor.count) {
            await emitNext(context, id, cursor, doneIndex);
            return 0;
        }
        // Record the acknowledgement before the delay, so the item timeout firing meanwhile (a delay
        // close to the item timeout) cannot take the item as unacknowledged. The timeout stays set:
        // if the process waiting on the delay dies, it is what moves the loop on.
        await context.stateSet(id, { ...cursor, acked: true });
        return cursor.delay;
    });

    if (!delay) {
        return;
    }

    // Outside of the lock: the delay can be longer than the lock TTL.
    await new Promise(resolve => setTimeout(resolve, delay));

    return withLock(context, id, async () => {
        const current = await context.stateGet(id);
        // The item timeout already moved the loop on (or the loop is gone).
        if (!current || current.index !== doneIndex || !current.acked) {
            return;
        }
        return emitNext(context, id, current, doneIndex);
    });
}

/**
 * Handle the webhook delivery sent by ContinueEach.
 * @param {Object} context - Appmixer context
 */
async function handleAck(context) {

    const { id, index, result } = (context.messages.webhook.content || {}).data || {};
    // Number() alone turns null, false, [] and '' into 0 - only a number or a numeric string counts.
    const isNumeric = typeof index === 'number' || (typeof index === 'string' && index.trim() !== '');
    const doneIndex = isNumeric ? Number(index) : NaN;

    // Anything can POST to a webhook URL - ignore whatever is not a well-formed acknowledgement.
    if (!id || !Number.isInteger(doneIndex) || doneIndex < 0) {
        return context.log({ step: 'invalid-ack', message: 'Each sequential: ignoring a malformed acknowledgement.' });
    }

    const isEntry = result && typeof result === 'object' && !Array.isArray(result);
    return acknowledge(context, id, doneIndex, isEntry ? result : {});
}

/**
 * Handle the item timeout: the item in flight was not acknowledged in time, move on. Only the timeout
 * of the current attempt for the item in flight counts; a stale one is ignored.
 * @param {Object} context - Appmixer context
 */
async function handleTimeout(context) {

    const { id, index, timeoutToken } = context.messages.timeout.content;

    // A timeout without a token was set by the previous version - matched by the index alone.
    const isCurrent = cursor => cursor && cursor.index === index &&
        (!timeoutToken || cursor.timeoutToken === timeoutToken);

    return withLock(context, id, async () => {
        const current = await context.stateGet(id);
        if (!isCurrent(current)) {
            return;
        }
        await context.log({
            step: 'item-timeout',
            message: current.acked
                // Acknowledged, but the delay before the next item has not run out (it is close to the
                // item timeout, or the process waiting on it died).
                ? `Each sequential: item ${index} was acknowledged, continuing with the next item before the delay ran out.`
                : `Each sequential: item ${index} was not acknowledged by ContinueEach in time, continuing with the next item.`
        });
        // A skipped item still has its entry in the result - null - so entries and items line up.
        const results = current.acked ? current.results : (current.results || []).concat([null]);
        // The timeout that fired needs no clearing.
        return emitNext(context, id, { ...current, results, timeoutId: null }, index);
    });
}

module.exports = {
    DEFAULT_ITEM_TIMEOUT,
    MIN_ITEM_TIMEOUT,
    handleStart,
    handleAck,
    handleTimeout
};
