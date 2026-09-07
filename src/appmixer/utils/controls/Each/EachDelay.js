'use strict';

// Everything related to the Each "delay" feature lives here. When a delay between items is set, the
// list cannot be emitted in a single tight loop (it would block one receive() handler for the whole
// duration and overrun the engine's message processing window). Instead the list is processed in
// batches: each batch fits inside one engine timeout window, and a scheduled timeout drives the next
// batch. The remaining items are parked in the plugin store (see routes.js) because timeout
// deliveries do not carry the original `in` message.

// Timeout interval in milliseconds (3 minutes). Also the wall-clock budget for a single batch.
const TIMEOUT_INTERVAL = (context) => parseInt(context.config.timeoutIntervalMs, 10) || 180000;
// Safety margin to account for sendJson latency (use 85% of timeout, reserve 15%).
const TIMEOUT_SAFETY_MARGIN = 0.85;

const storeEndpoint = id => `/plugins/appmixer/utils/controls/${encodeURIComponent(id)}`;

/**
 * Calculate upper bound on batch size based on delay and timeout interval.
 * Actual items sent may be fewer due to wall-clock safety margin in sendBatch.
 * @param {Object} context - Appmixer context
 * @param {number} delay - Delay between items in milliseconds
 * @returns {number} - Upper bound on items per batch (used for pre-slicing, not guaranteed count)
 */
function calculateBatchSize(context, delay) {
    // Always return a finite size of at least 1 so the loop makes progress. A batch size below 1
    // (e.g. a custom timeoutIntervalMs config smaller than the delay) or a non-finite one (NaN/
    // Infinity from a bad delay) would otherwise send no items, never advance the index, and
    // re-schedule timeouts forever. Note Math.max(1, NaN) === NaN, so NaN must be handled explicitly.
    const size = Math.floor(TIMEOUT_INTERVAL(context) / delay);
    return Number.isFinite(size) && size >= 1 ? size : 1;
}

/**
 * Send a batch of items with delay between each item.
 * Stops early if the timeout safety deadline is exceeded.
 * @param {Object} context - Appmixer context
 * @param {Array} items - Items to send
 * @param {number} startIndex - Starting index in the original list
 * @param {number} count - Total count of items
 * @param {string} correlationId - Correlation ID for this Each execution
 * @param {number} delay - Delay between items in milliseconds
 * @returns {number} - Number of items actually sent (may be less than items.length if deadline exceeded)
 */
async function sendBatch(context, items, startIndex, count, correlationId, delay) {

    const startTime = Date.now();
    const deadline = TIMEOUT_INTERVAL(context) * TIMEOUT_SAFETY_MARGIN;
    let i = 0;

    for (; i < items.length; i++) {
        // Check if we're approaching the timeout deadline
        if (Date.now() - startTime >= deadline) {
            break;
        }

        const listItem = {
            index: startIndex + i,
            value: items[i],
            count,
            correlationId
        };
        await context.sendJson(listItem, 'item');

        // Add delay between items (except for the last item)
        if (delay && i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return i;
}

/**
 * Handle a scheduled timeout delivery: continue a delayed Each loop with the next batch.
 * The items live in the plugin store; the current index lives in component state.
 * @param {Object} context - Appmixer context
 */
async function handleTimeout(context) {

    const { id } = context.messages.timeout.content;

    // Fetch the stored data from the plugin (items list only)
    const storedData = await context.callAppmixer({
        endPoint: storeEndpoint(id),
        method: 'GET'
    });

    if (!storedData || !storedData.items) {
        // Data no longer exists, nothing to process
        await context.log({ 'step': 'no-data', message: 'Each timeout: nothing to process, stored data missing or has no items' });
        return;
    }

    const { items, delay, correlationId, count } = storedData;

    // Get current index from state (same pattern as non-delayed Each)
    const lastSentIndexCache = await context.stateGet(id);
    const currentIndex = lastSentIndexCache?.index || 0;

    const batchSize = calculateBatchSize(context, delay);

    if (currentIndex >= items.length) {
        // All items have been processed, clean up and send done
        await context.callAppmixer({
            endPoint: storeEndpoint(id),
            method: 'DELETE'
        });
        await context.stateUnset(id);
        await context.sendJson({ count, correlationId }, 'done');
        return;
    }

    // Get the batch to process (single slice, bounded by the batch-size upper bound)
    const batchItems = items.slice(currentIndex, currentIndex + batchSize);

    // Send the batch with delays, returns actual count sent (may be less if deadline exceeded)
    const actualSent = await sendBatch(context, batchItems, currentIndex, count, correlationId, delay);
    const newIndex = currentIndex + actualSent;

    // Persist progress once the batch finishes. This is at-least-once: a crash after some
    // items were sent but before this stateSet will re-deliver the timeout and re-send the batch.
    await context.stateSet(id, { index: newIndex });

    if (newIndex >= items.length) {
        // All items have been sent, clean up and send done
        await context.callAppmixer({
            endPoint: storeEndpoint(id),
            method: 'DELETE'
        });
        await context.stateUnset(id);
        await context.sendJson({ count, correlationId }, 'done');
    } else {
        // Schedule next timeout
        await context.setTimeout({ id, timestamp: new Date() }, TIMEOUT_INTERVAL(context));
    }
}

/**
 * Handle the first (immediate) batch of a delayed Each loop, triggered by the `in` message.
 * Resumable: if the engine re-delivers `in` after an error, state holds our progress and we continue
 * from there instead of restarting from index 0.
 * @param {Object} context - Appmixer context
 * @param {Object} params
 * @param {Array} params.list - The full list to iterate
 * @param {string} params.correlationId - Correlation ID for this Each execution (the retry-stable context.id)
 * @param {number} params.count - Total count of items
 * @param {number} params.delay - Delay between items in milliseconds
 */
async function handleDelayedStart(context, { list, correlationId, count, delay }) {

    const id = context.id;
    const batchSize = calculateBatchSize(context, delay);

    // Resume support. If this `receive` runs because the engine re-delivered the `in` message after a
    // previous attempt threw (its built-in retry), state holds our progress. Continue from there
    // instead of restarting from index 0 (which would re-send everything). The correlationId comes
    // from the retry-stable context.id, so it matches across the re-delivery without being persisted.
    // The list itself is still available from the re-delivered `in` message, so no plugin store is
    // needed to resume the first batch.
    const existingState = await context.stateGet(id);
    const startIndex = existingState?.index || 0;

    if (startIndex >= list.length) {
        // Already finished on a prior attempt - just finalize.
        await context.stateUnset(id);
        await context.sendJson({ count, correlationId }, 'done');
        return;
    }

    // Send the batch with delays, returns actual count sent (may be less if deadline exceeded).
    const batchItems = list.slice(startIndex, startIndex + batchSize);
    const actualSent = await sendBatch(context, batchItems, startIndex, count, correlationId, delay);
    const newIndex = startIndex + actualSent;

    await context.stateSet(id, { index: newIndex });

    if (newIndex >= list.length) {
        // All items sent. Nothing was ever stored in the plugin, so just finish.
        await context.stateUnset(id);
        await context.sendJson({ count, correlationId }, 'done');
    } else {
        // More items remain: hand off to the timeout-driven flow. The timeout delivery does not have
        // the original `in` message, so the remaining items must live in the plugin store. If this
        // POST throws (e.g. dropped keep-alive -> EPROTO), the engine re-delivers `in`, we resume from
        // `newIndex` (no re-send of the items already emitted) and retry the store on a fresh connection.
        await context.callAppmixer({
            endPoint: storeEndpoint(id),
            method: 'POST',
            body: {
                items: list,
                delay,
                correlationId,
                count
            }
        });
        await context.setTimeout({ id, timestamp: new Date() }, TIMEOUT_INTERVAL(context));
    }
}

module.exports = {
    TIMEOUT_INTERVAL,
    TIMEOUT_SAFETY_MARGIN,
    calculateBatchSize,
    sendBatch,
    handleTimeout,
    handleDelayedStart
};
