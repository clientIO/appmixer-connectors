const lib = require('../../lib');
const uuid = require('uuid').v4;
const moment = require('moment');

// Upper bounds for the lock configuration. The knobs are configurable per
// connector, but without a cap a misconfigured value could make each lock
// acquisition wait far longer than a receive() is allowed to run.
const MAX_LOCK_RETRY_DELAY = 5000; // 5s
const MAX_LOCK_TTL = 15 * 60 * 1000; // 15 min
const MAX_LOCK_MAX_RETRY_COUNT = 40;

// A prepared upload batch belongs to the receive() that is uploading it. Only a
// batch older than this can be a leftover of a crashed run and may be resumed —
// resuming a batch another receive() is still uploading sends it to Wiz twice.
const UPLOAD_BATCH_STALE_MS = MAX_LOCK_TTL;

// Delay before a scheduled drain continuation fires. Draining a large backlog
// happens one batch per receive() (see processAllDocuments) — the rest of the
// backlog is picked up by a follow-up context.setTimeout message instead of
// looping inside a single receive() call.
// Delay of a scheduled drain continuation. The engine's timeout scheduler works
// at a ~1 minute granularity — a shorter timeout is simply never delivered (the
// same reason gladia/googleAds pin their continuations to >= 60s), which would
// strand the rest of the backlog until the next message arrives.
const DRAIN_CONTINUATION_DELAY = 60 * 1000; // 60s

// Log a warning when the pending-documents state grows past this size — the
// backlog lives in a single state document and is read back in full on every
// receive(), so unbounded growth degrades exactly under burst conditions.
const DOCUMENTS_BACKLOG_WARNING = 5000;

const getLockConfiguration = (context) => {

    return {
        retryDelay: Math.min(parseInt(context.config.uploadLockRetryDelay, 10) || 3000, MAX_LOCK_RETRY_DELAY),
        ttl: Math.min(parseInt(context.config.uploadLockTtl, 10) || 15 * 60 * 1000, MAX_LOCK_TTL),
        maxRetryCount: Math.min(parseInt(context.config.uploadLockMaxRetryCount, 10) || 60, MAX_LOCK_MAX_RETRY_COUNT)
    };
};

module.exports = {

    start(context) {

        context.log({
            step: 'start', lockConfiguration: getLockConfiguration(context)
        });

        const { scheduleValue } = context.properties;
        if (scheduleValue) {
            return this.scheduleDrain(context);
        }
    },

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { threshold, scheduleValue } = context.properties;

        if (context.messages.timeout) {
            const timeoutContent = context.messages.timeout.content || {};

            if (timeoutContent.drainContinuation) {
                // Follow-up of a previous drain (see processAllDocuments). Do not
                // touch the schedule — just process the next batch of the backlog.
                const entries = await context.stateGet('documents') || [];
                if (entries.length > 0) {
                    await this.processAllDocuments(context, {
                        threshold: timeoutContent.threshold,
                        timeoutTrigger: timeoutContent.timeoutTrigger
                    });
                }
                return;
            }

            await this.scheduleDrain(context);
            const entries = await context.stateGet('documents') || [];
            if (entries.length > 0) {
                await this.processAllDocuments(context, { threshold, timeoutTrigger: true });
            }
        } else {
            const { document, filename, integrationId } = context.messages.in.content;

            if (!await context.stateGet('metadata')) {
                await context.stateSet('metadata', { filename, integrationId });
            }

            await context.stateAddToSet('documents', { id: uuid(), data: document });
            const entries = await context.stateGet('documents') || [];

            await context.log({ step: 'receive', entries: entries.length });
            if (entries.length >= DOCUMENTS_BACKLOG_WARNING) {
                await context.log({
                    step: 'receive',
                    warning: `Pending documents backlog reached ${entries.length} entries. ` +
                        'The backlog is stored in a single component state document; consider a lower threshold ' +
                        'or a more frequent schedule so uploads keep up with the incoming rate.'
                });
            }

            if (!scheduleValue || (threshold && entries.length >= threshold)) {
                await this.processAllDocuments(context, { threshold });
            }
        }
    },

    // Process exactly ONE batch of the backlog. If more qualifying documents
    // remain, schedule a drain-continuation timeout instead of recursing — a
    // single receive() must never drain the whole backlog (with locks and status
    // polling per batch it would easily exceed the engine's receive() timeout
    // and RabbitMQ's consumer timeout; see appmixer-components issue #2793).
    async processAllDocuments(context, { threshold, timeoutTrigger = false } = {}) {
        const documents = await this.prepareForSend(context, { threshold, timeoutTrigger });
        await this.processSend(context, { documents });
        const entries = await context.stateGet('documents') || [];
        const backlogRemains = (threshold && entries.length >= threshold) || (timeoutTrigger && entries.length > 0);
        if (backlogRemains) {
            await context.log({
                step: 'drain-continuation-scheduled',
                remainingEntries: entries.length,
                delay: DRAIN_CONTINUATION_DELAY
            });
            await context.setTimeout(
                { drainContinuation: true, threshold, timeoutTrigger },
                DRAIN_CONTINUATION_DELAY
            );
        }
    },

    async prepareForSend(context, { threshold, timeoutTrigger = false }) {

        const entriesToUpload = await context.stateGet('documents-upload-batch');
        // A batch left in state is a crash leftover only once it is older than the
        // lock TTL; until then it belongs to the receive() that is uploading it.
        let resumableBatch = false;
        if (entriesToUpload) {
            if (entriesToUpload.length > 0) {
                const startedAt = await context.stateGet('documents-upload-batch-startedAt');
                if (startedAt && Date.now() - startedAt < UPLOAD_BATCH_STALE_MS) {
                    await context.log({
                        step: 'pre-upload: skipping, upload already in progress',
                        message: `Found ${entriesToUpload.length} documents in documents-upload-batch.`
                    });
                    return [];
                }
                resumableBatch = true;
            } else {
                // Empty batch from previous interrupted run, clean it up
                await context.stateUnset('documents-upload-batch');
                await context.stateUnset('documents-upload-batch-startedAt');
            }
        }

        if (!resumableBatch && threshold && !timeoutTrigger
            && (await context.stateGet('documents') || []).length < threshold) {
            await context.log({ step: 'pre-upload: skipping, not enough documents' });
            return [];
        }

        let prepareDocumentsLock;
        try {

            // https://docs.appmixer.com/6.0/v4.1/component-definition/behaviour#async-context.lock-lockname-options
            prepareDocumentsLock = await context.lock(context.componentId, getLockConfiguration(context));

            const entriesToUpload = await context.stateGet('documents-upload-batch');
            let documents = [];

            if (entriesToUpload && entriesToUpload.length > 0) {
                // The batch is either being uploaded by another receive() right now
                // (the pre-lock check above races with it) or left behind by a crash.
                const startedAt = await context.stateGet('documents-upload-batch-startedAt');
                const age = startedAt ? Date.now() - startedAt : Infinity;
                if (age < UPLOAD_BATCH_STALE_MS) {
                    await context.log({
                        step: 'pre-upload: skipping, upload already in progress',
                        message: `Found ${entriesToUpload.length} documents in documents-upload-batch.`,
                        batchAge: startedAt ? age : undefined
                    });
                    return [];
                }
                documents = entriesToUpload.map(entry => entry.data);
                await context.log({
                    step: 'documents-upload-batch docs',
                    message: `Resuming ${documents.length} documents left by an interrupted upload.`,
                    batchAge: startedAt ? age : undefined
                });

            } else {
                let entries = (await context.stateGet('documents') || []);

                if (threshold && entries.length >= threshold) {
                    // Split: keep extras, process last `threshold` entries. This
                    // applies to the scheduled (timeout) drain too — one huge
                    // backlog must not become a single oversized PUT; the
                    // remainder continues via the drain-continuation timeout.
                    const batchEntries = entries.slice(-threshold);
                    await context.stateSet('documents', entries.slice(0, -threshold));
                    await context.stateSet('documents-upload-batch', batchEntries);
                    await context.stateSet('documents-upload-batch-startedAt', Date.now());
                    entries = batchEntries;
                } else {
                    // Process all entries (no threshold, or below-threshold timeout drain)
                    if (entries.length > 0) {
                        await context.stateSet('documents-upload-batch', entries);
                        await context.stateSet('documents-upload-batch-startedAt', Date.now());
                    }
                    await context.stateUnset('documents');
                }
                await context.log({
                    step: 'prepareForSend',
                    entries: entries.length,
                    threshold,
                    message: `Prepared ${entries.length} documents for upload.`
                });
                documents = entries.map(entry => entry.data);
            }

            return documents;
        } finally {
            prepareDocumentsLock?.unlock();
        }
    },

    async processSend(context, { documents }) {

        if (!documents || documents.length === 0) {
            return;
        }

        let lock;

        try {

            lock = await context.lock('upload_lock_' + context.componentId, getLockConfiguration(context));
            await this.sendDocuments(context, { documents });
        } finally {
            await context.stateUnset('documents-upload-batch');
            await context.stateUnset('documents-upload-batch-startedAt');
            lock?.unlock();
        }
    },

    async scheduleDrain(context) {

        const { scheduleValue, scheduleType } = context.properties;
        const now = moment();
        const referenceDate = moment();

        const timeoutId = await context.stateGet('timeoutId');

        if (timeoutId && context.messages?.timeout && context.messages.timeout.timeoutId !== timeoutId) {
            // Handle the case when a timeout was scheduled but the system crashed before the
            // corresponding timeoutId was saved into the state. The original timeout then fired
            // again, state was 'JsonSent', and a new timeout was scheduled for the second time.
            // At this point, there can be two timeouts persisted in the DB. We must process only
            // the timeout whose ID matches the value stored in the state and ignore the others.
            return;
        }

        if (!['minutes', 'hours', 'days'].includes(scheduleType)) {
            throw new context.CancelError(`Invalid scheduleType: ${scheduleType}`);
        }

        const nextDate = referenceDate.add(scheduleValue, scheduleType);
        const diff = nextDate.diff(now);
        if (diff <= 0) {
            throw new context.CancelError(`Computed timeout is non‑positive (${diff} ms). Check schedule parameters.`);
        }

        const newTimeoutId = await context.setTimeout({}, diff);
        await context.stateSet('timeoutId', newTimeoutId);
        await context.log({ step: 'schedule', nextDate: nextDate.toISOString(), timeoutId: newTimeoutId });
    },

    async sendDocuments(context, { documents }) {

        const { integrationId, filename } = await context.stateGet('metadata') || {};

        if (!integrationId || !filename) {
            throw new context.CancelError('No metadata found in state. Cannot send documents.');
        }

        const { url, systemActivityId } = await lib.requestUpload(context, { filename });

        const fileContent = {
            integrationId,
            dataSources: documents
        };

        await lib.uploadFile(context, { url, fileContent });
        const systemActivity = await lib.getStatus(context, systemActivityId);

        // throw error if the system activity is not valid.
        lib.validateUploadStatus(context, { systemActivity });

        return context.sendJson(systemActivity, 'out');
    }
};

