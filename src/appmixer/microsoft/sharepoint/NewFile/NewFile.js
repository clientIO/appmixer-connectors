'use strict';
const moment = require('moment');
const Promise = require('bluebird');

const commons = require('../../microsoft-commons');

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
        expirationDateTime: moment().add(29, 'days').toISOString(),
        clientState: context.componentId
    };
    return commons.formatError(() => {
        return commons.post('/subscriptions', context.auth.accessToken, body);
    });
};

/**
 * Component which triggers whenever a new file is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        const { accessToken } = context.auth;
        const { driveId } = context.properties;
        const latest = await getLatestChanges(`/drives/${driveId}/root/delta?token=latest`, accessToken);
        const state = {
            deltaLink: latest['@odata.deltaLink'],
            lastUpdated: moment().toISOString()
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

            if (query && query.validationToken) {
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

                        latest.value.forEach((file) => {
                            const createdDateTime = file.createdDateTime;
                            if (
                                createdDateTime &&
                                moment(lastUpdated).isSameOrBefore(createdDateTime)
                            ) {
                                promises.push(context.sendJson(file, 'file'));
                            }
                        });
                        state.lastUpdated = moment().toISOString();

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

            const renewDate = moment(expiryDate).subtract(3, 'days');

            if (moment().isSameOrAfter(renewDate)) {
                const body = { expirationDateTime: moment().add(29, 'days').toISOString() };
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
