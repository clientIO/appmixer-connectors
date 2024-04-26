'use strict';

async function* fetchErrorsGenerator(context, lock, limit, logId = null, lastGridTimestamp = null, size = 100) {

    let remainingLimit = limit;

    while (remainingLimit > 0) {

        const pageSize = Math.min(remainingLimit, size);
        const qs = {
            size: pageSize,
            query: 'severity:error',
            flowId: context.flowId,
            sort: ['_id:asc', 'gridTimestamp:asc']
        };

        if (logId && lastGridTimestamp) {
            qs.searchAfter = [logId, lastGridTimestamp];
        }

        const result = await context.callAppmixer({
            endPoint: '/logs',
            method: 'GET',
            qs
        });

        if (result?.hits?.length > 0) {

            await lock.extend(parseInt(context.config.lockTTL, 10) || 1000 * 60 * 2);
            yield result.hits;
            remainingLimit -= result.hits.length;
            const lastHit = result.hits[result.hits.length - 1];
            logId = lastHit['_id'];
            lastGridTimestamp = lastHit.gridTimestamp;
        } else {
            break; // No more logs to fetch
        }
    }
}

// Adds labels to errors for better identification
function addLabels(context, errors) {

    return errors.map(err => ({
        ...err,
        flowName: context.flowInfo.flowName,
        componentLabel: err.componentId ? (context.flowDescriptor[err.componentId]?.label || err.componentType.split('.')[3]) : undefined
    }));
}

module.exports = {

    async tick(context) {

        const lockName = `errorProcessingLock-${context.componentId}`; // Define a unique lock name
        let lock;
        try {
            lock = await context.lock(lockName, { ttl: context.config.lockTTL || 1000 * 60 * 5, maxRetryCount: 0 });
            const { lastLogId, gridTimestamp } = context.state;
            const limit = context.properties.limit
                ? Math.min(parseInt(context.properties.limit), parseInt(context.config.limit) || Infinity)
                : parseInt(context.config.limit) || 1000;

            for await (const batch of fetchErrorsGenerator(context, lock, limit, lastLogId, gridTimestamp)) {
                if (batch.length > 0) {
                    // Update state with the _id of the last log in the page
                    const newLastLogId = batch[batch.length - 1]['_id'];
                    const newGridTimestamp = batch[batch.length - 1]['gridTimestamp'];
                    await context.saveState({ lastLogId: newLastLogId, gridTimestamp: newGridTimestamp });

                    // Process and send the errors to outport
                    const labeledErrors = addLabels(context, batch);
                    await context.sendArray(labeledErrors, 'out');
                }
            }
        } finally {
            if (lock) {
                // Release the lock when done
                lock.unlock();
            }
        }
    }
};
