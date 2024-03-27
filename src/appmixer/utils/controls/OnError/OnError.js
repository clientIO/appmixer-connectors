'use strict';

async function fetchErrorsPage(context, lock, limit, logId = null, lastGridTimestamp = null, size = 100, errors = []) {

    const qs = {
        size: Math.min(limit, size),
        query: 'severity:error',
        flowId: context.flowId
    };

    if (logId && lastGridTimestamp) {
        qs.searchAfter = [logId, lastGridTimestamp];
    }

    while (true) {
        try {
            const result = await context.callAppmixer({
                endPoint: '/logs',
                method: 'GET',
                qs
            });

            if (!(result.hits && result.hits.length > 0 && limit > result.hits.length)) {
                break;
            }

            lock.extend(parseInt(context.config.lockTTL, 10) || 1000 * 60 * 2);
            const lastLog = result.hits[result.hits.length - 1];
            errors.push(...result.hits);

            if (errors.length >= limit) {
                break;
            }

            qs.searchAfter = [lastLog['_id'], lastLog['gridTimestamp']];
        } catch (error) {
            console.error('Error fetching errors:', error);
            await context.log({ level: 'error', error: error.message || error });
            break;
        }
    }

    return errors;
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
            // ensure that if there is a limit set by context.config.limit
            const limit = context.properties.limit
                ? Math.min(
                    parseInt(context.properties.limit),
                    parseInt(context.config.limit) || Infinity
                )
                : parseInt(context.config.limit) || 100;

            const result = await fetchErrorsPage(context, lock, limit, lastLogId, gridTimestamp);

            if (result?.length > 0) {
                // Process and send the errors to outport
                const labeledErrors = addLabels(context, result);
                await context.sendArray(labeledErrors, 'out');

                // Update state with the _id of the last log in the page
                const newLastLogId = result[result.length - 1]['_id'];
                const newGridTimestamp = result[result.length - 1]['gridTimestamp'];
                return context.saveState({ lastLogId: newLastLogId, gridTimestamp: newGridTimestamp });
            }
        } catch (error) {
            await context.log({ level: 'error', message: error.message || error });
        } finally {
            if (lock) {
                // Release the lock when done
                lock.unlock();
            }
        }
    }
};
