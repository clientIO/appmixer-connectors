'use strict';
const commons = require('../../microsoft-commons');
const delta = require('../../microsoft-delta');
const lib = require('../lib');

const getDeltaPath = (context) => {

    const { driveId, parentPath } = context.properties;
    const path = parentPath ? `:/${parentPath}:` : '';
    return `/drives/${driveId}/root${path}/delta`;
};

const getFileTypesRestriction = (context) => {

    const { fileTypesRestriction } = context.properties;
    return fileTypesRestriction ?
        lib.normalizeMultiselectInput(fileTypesRestriction, context, 'File Types Restriction') : [];
};

const isUpdatedFile = (file, lastUpdated) => {

    const isFile = Object.keys(file).includes('file');
    const isDeleted = Object.keys(file).includes('deleted');
    const createdDateTime = file.createdDateTime;
    return !!(
        isFile && createdDateTime && !isDeleted &&
        new Date(lastUpdated) > new Date(createdDateTime)
    );
};

const matchesFileTypes = (file, fileTypesRestriction) => {

    if (!fileTypesRestriction.length) return true;
    return fileTypesRestriction.some(typeRestriction => file.file.mimeType?.startsWith(typeRestriction));
};

const registerWebhook = async (context) => {

    const { driveId } = context.properties;
    const body = {
        changeType: 'updated',
        notificationUrl: context.getWebhookUrl(),
        resource: `drives/${driveId}/root`,
        expirationDateTime: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString(),
        clientState: context.componentId
    };

    return commons.formatError(() => {
        return commons.post('/subscriptions', context.auth.accessToken, body);
    });
};

/**
 * Work through the delta backlog page by page, emitting the updated files of each page and
 * persisting the resume link before moving on to the next one.
 * @param {Context} context
 * @return {Promise<void>}
 */
const processChanges = async (context) => {

    const fileTypesRestriction = getFileTypesRestriction(context);

    return delta.runDeltaScan(context, {
        startLink: (state) => state.deltaLink,
        onPage: async (files, { state, extend }) => {
            let emitted = 0;
            for (const file of files) {
                if (!isUpdatedFile(file, state.lastUpdated)) continue;
                if (!matchesFileTypes(file, fileTypesRestriction)) continue;
                await context.sendJson(file, 'file');
                emitted += 1;
                if (emitted % delta.LOCK_EXTEND_EVERY_ITEMS === 0) {
                    // Emitting a large page must not outlive the last lock extension either.
                    await extend();
                }
            }
        },
        saveProgress: async (link, { caughtUp, watermark }) => {
            await context.stateSet('deltaLink', link);
            if (caughtUp) {
                // `lastUpdated` is the "we have caught up to here" watermark and may only be
                // advanced once the whole chain is consumed - the pages still to come hold
                // files this cutoff would otherwise misclassify. It is when the chain was
                // started, not "now", so a file created while it was being read is not
                // reported as an update on the next round.
                await context.stateSet('lastUpdated', watermark);
            }
        }
    });
};

module.exports = {

    async start(context) {

        const { accessToken } = context.auth;
        const state = {
            deltaLink: await delta.fetchLatestDeltaLink(getDeltaPath(context), accessToken),
            lastUpdated: new Date().toISOString()
        };

        const { id, expirationDateTime } = await registerWebhook(context);

        state.webhookId = id;
        state.expiryDate = expirationDateTime;

        return context.saveState(state);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {
        if (context.messages.webhook) {
            const { query, data } = context.messages.webhook.content;

            if (query?.validationToken) {
                return context.response(query.validationToken);
            }

            const { value } = data;
            if (Array.isArray(value)) {
                // If just one clientState is invalid, we discard the whole batch.
                const clientStatesValid = value.every(v => v.clientState === context.componentId);

                if (clientStatesValid) {
                    await processChanges(context);
                }
            }

            return context.response();
        }
    },

    async stop(context) {

        const { accessToken } = context.auth;
        const { webhookId } = await context.loadState();

        if (webhookId) {
            return commons.formatError(() => {
                return commons.delete(`/subscriptions/${webhookId}`, accessToken);
            });
        }
    },

    async test(context) {

        // Flow Test Mode: no webhook fires. Read the current delta WITHOUT the baseline
        // deltaLink that start()/receive() use to suppress already-seen items, then emit the
        // most recently modified (non-deleted) file. Same delta fetch, fileTypesRestriction
        // filter and identical delta-item shape `receive()` forwards.
        const { accessToken } = context.auth;
        const fileTypesRestriction = getFileTypesRestriction(context);
        const { items } = await delta.fetchDeltaPages(getDeltaPath(context), accessToken, {
            maxPages: delta.TEST_MODE_MAX_PAGES
        });

        const files = items.filter((file) => {
            const isFile = Object.keys(file).includes('file');
            const isDeleted = Object.keys(file).includes('deleted');
            if (!isFile || isDeleted) {
                return false;
            }
            return matchesFileTypes(file, fileTypesRestriction);
        });

        if (!files.length) {
            throw new Error('No matching files found in the Drive to use as test data.');
        }

        const newest = files
            .slice()
            .sort((a, b) => new Date(b.lastModifiedDateTime || 0) - new Date(a.lastModifiedDateTime || 0))[0];

        return context.sendJson(newest, 'file');
    },

    async tick(context) {

        const { accessToken } = context.auth;
        const { webhookId, expiryDate, [delta.SKIPPED_FLAG]: hasSkippedMessage } = await context.loadState();

        if (!webhookId) {
            // Not subscribed - there is no delta to continue and nothing to renew.
            return;
        }

        if (hasSkippedMessage) {
            // A notification arrived while we were already processing, or the backlog did not
            // fit into a single run. Carry on with the rest of it.
            await processChanges(context);
        }

        const renewDate = new Date(expiryDate).setDate(new Date(expiryDate).getDate() - 3);

        if (new Date() >= new Date(renewDate)) {
            // A contended lock means a receive() is working through a backlog - skip the
            // renewal and retry on the next tick instead of storming the lock.
            await delta.withComponentLock(context, { step: 'webhook-renewal-skipped' }, async (lock) => {
                const body = { expirationDateTime: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString() };
                try {
                    const { expirationDateTime } = await commons.formatError(() => {
                        return commons.patch(`/subscriptions/${webhookId}`, accessToken, body);
                    });

                    await context.stateSet('expiryDate', expirationDateTime);
                } catch (err) {
                    if (err?.statusCode === 404) {
                        // Re-arm the lock: creating a replacement subscription is a second
                        // Graph round trip and must not run once the TTL has elapsed.
                        await delta.extendLock(lock);
                        const { id, expirationDateTime } = await registerWebhook(context);
                        await context.stateSet('webhookId', id);
                        await context.stateSet('expiryDate', expirationDateTime);
                    } else {
                        throw err;
                    }
                }
            });
        }
    }
};
