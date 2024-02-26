'use strict';

function getCorrelationId(message) {

    return message.content.correlationId || message.correlationId;
}

module.exports = {

    async receive(context) {

        if (context.messages.count) {

            if (context.messages.count.content.count === 0) {
                // if the array is empty, then there will be no message on the 'in' port, we can directly
                // send a message to the 'out' port.
                return context.sendJson({ items: [] }, 'out');
            }

            const correlationId = getCorrelationId(context.messages.count);
            // we need to know the number of messages to wait for (with the same correlationId)
            let lock = null;
            try {
                lock = await context.lock(correlationId);
                const count = context.messages.count.content.count;

                // if the awaited number of items is 0, we won't be storing anything into state
                if (count === 0) {
                    return;
                }

                const correlationIdState = await context.stateGet(correlationId) || {};
                correlationIdState.count = count;

                // all messages for this correlationId already arrived (before a message to the done
                // port arrived)
                if (correlationIdState.inputMessages
                    && correlationIdState.inputMessages.length >= count) {
                    await context.stateUnset(correlationId);
                    if (correlationIdState.timeoutId) {
                        await context.clearTimeout(correlationIdState.timeoutId);
                    }
                    return context.sendJson({ items: correlationIdState.inputMessages }, 'out');
                }

                if (context.messages.count.content.timeout) {
                    correlationIdState.timeoutId = await context.setTimeout(
                        { correlationId },
                        context.messages.count.content.timeoutValue * 1000);
                }

                await context.stateSet(correlationId, correlationIdState);
            } finally {
                lock && lock.unlock();
            }
        }

        if (context.messages.timeout) {

            let lock = null;
            try {
                const correlationId = getCorrelationId(context.messages.timeout);
                lock = await context.lock(correlationId);

                const correlationIdState = await context.stateGet(correlationId) || {};

                if (!correlationIdState.timeoutId) {
                    // before getting the lock, an input message may have arrived and timeout
                    // may have been cleared, in that case, do nothing
                    return;
                }

                await context.stateUnset(correlationId);
                return context.sendJson({
                    items: correlationIdState.inputMessages || [],
                    count: correlationIdState.count,
                    arrived: (correlationIdState.inputMessages || []).length
                }, 'timeout');
            } finally {
                lock && lock.unlock();
            }
        }

        if (context.messages.in) {

            let lock = null;
            try {
                const correlationId = getCorrelationId(context.messages.in);
                lock = await context.lock(correlationId);
                const correlationIdState = await context.stateGet(correlationId) || {};
                correlationIdState.inputMessages = correlationIdState.inputMessages || [];
                correlationIdState.inputMessages.push(context.messages.in.originalContent);

                // message to the 'done' port with the number of items to wait for has not arrived yet
                if (!correlationIdState.hasOwnProperty('count')
                    // or the number of input messages is lower than the expected number
                    || !(correlationIdState.inputMessages.length >= correlationIdState.count)) {
                    await context.stateSet(correlationId, correlationIdState);
                    return;
                }

                if (correlationIdState.inputMessages.length >= correlationIdState.count) {
                    // all messages for that particular correlationId have arrived
                    await context.stateUnset(correlationId);
                    if (correlationIdState.timeoutId) {
                        await context.clearTimeout(correlationIdState.timeoutId);
                    }
                    return context.sendJson({ items: correlationIdState.inputMessages }, 'out');
                }
            } finally {
                lock && lock.unlock();
            }
        }
    }
};
