'use strict';
const commons = require('../../microsoft-commons');
const lib = require('../lib');

const getLatestChanges = async (deltaLink, accessToken) => {

    const currentPage = await commons.formatError(() => {
        return commons.get(deltaLink, accessToken);
    });
    if (currentPage['@odata.deltaLink']) {
        return currentPage;
    }

    const nextPage = await getLatestChanges(currentPage['@odata.nextLink'], accessToken);
    nextPage.value = currentPage.value.concat(nextPage.value);

    return nextPage;
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

module.exports = {

    async start(context) {

        const { accessToken } = context.auth;
        const { driveId, parentPath } = context.properties;
        const path = parentPath ? `:/${parentPath}:` : '';
        const latest = await getLatestChanges(`/drives/${driveId}/root${path}/delta?token=latest`, accessToken);
        const state = {
            deltaLink: latest['@odata.deltaLink'],
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
                let clientStatesValid = true;
                value.forEach((v) => {
                    if (v.clientState !== context.componentId) {
                        // If just one clientState is invalid, we discard the whole batch
                        clientStatesValid = false;
                    }
                });

                const { accessToken } = context.auth;

                let lock = null;
                try {
                    lock = await context.lock(context.componentId, { retryDelay: 2000 });

                    const state = await context.loadState();
                    const deltaLink = state.deltaLink;
                    const lastUpdated = state.lastUpdated;

                    if (clientStatesValid && deltaLink) {
                        const latest = await getLatestChanges(deltaLink, accessToken);
                        state.deltaLink = latest['@odata.deltaLink'];

                        const promises = [];
                        const { fileTypesRestriction } = context.properties;

                        // Normalize fileTypesRestriction to array format for multiselect field
                        const normalizedFileTypesRestriction = fileTypesRestriction ?
                            lib.normalizeMultiselectInput(fileTypesRestriction, context, 'File Types Restriction') : [];

                        latest.value.forEach((file) => {
                            const isFile = Object.keys(file).includes('file');
                            const isDeleted = Object.keys(file).includes('deleted');
                            const createdDateTime = file.createdDateTime;

                            if (
                                isFile && createdDateTime &&
                                new Date(lastUpdated) > new Date(createdDateTime) && !isDeleted
                            ) {
                                if (normalizedFileTypesRestriction.length > 0) {
                                    normalizedFileTypesRestriction.forEach((typeRestriction) => {
                                        if (file.file.mimeType.startsWith(typeRestriction)) {
                                            promises.push(context.sendJson(file, 'file'));
                                        }
                                    });
                                } else {
                                    promises.push(context.sendJson(file, 'file'));
                                }
                            }
                        });
                        state.lastUpdated = new Date().toISOString();

                        promises.push(context.saveState(state));
                        await Promise.all(promises);
                    }
                } finally {
                    if (lock) {
                        await lock.unlock();
                    }
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

        // Flow Test Mode: no webhook fires. Read the full current delta WITHOUT the
        // baseline deltaLink that start()/receive() use to suppress already-seen items,
        // then emit the most recently modified (non-deleted) file. Same getLatestChanges
        // fetch, fileTypesRestriction filter and identical delta-item shape `receive()` forwards.
        const { accessToken } = context.auth;
        const { driveId, parentPath, fileTypesRestriction } = context.properties;
        const path = parentPath ? `:/${parentPath}:` : '';
        const latest = await getLatestChanges(`/drives/${driveId}/root${path}/delta`, accessToken);

        const normalizedFileTypesRestriction = fileTypesRestriction ?
            lib.normalizeMultiselectInput(fileTypesRestriction, context, 'File Types Restriction') : [];

        const files = (latest.value || []).filter((file) => {
            const isFile = Object.keys(file).includes('file');
            const isDeleted = Object.keys(file).includes('deleted');
            if (!isFile || isDeleted) {
                return false;
            }
            if (normalizedFileTypesRestriction.length > 0) {
                return normalizedFileTypesRestriction.some(t => file.file.mimeType.startsWith(t));
            }
            return true;
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

        let lock;
        try {
            lock = await context.lock(context.componentId);

            const state = await context.loadState();

            const webhookId = state.webhookId;
            const expiryDate = state.expiryDate;

            if (!webhookId) {
                return;
            }

            const renewDate = new Date(expiryDate).setDate(new Date(expiryDate).getDate() - 3);

            if (new Date() >= new Date(renewDate)) {
                const body = { expirationDateTime: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString() };
                try {
                    const { expirationDateTime } = await commons.formatError(() => {
                        return commons.patch(`/subscriptions/${webhookId}`, accessToken, body);
                    });

                    state.expiryDate = expirationDateTime;
                } catch (err) {
                    if (err?.statusCode === 404) {
                        const { id, expirationDateTime } = await registerWebhook(context);
                        state.webhookId = id;
                        state.expiryDate = expirationDateTime;
                    } else {
                        throw err;
                    }
                }
                await context.saveState(state);
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    }
};
