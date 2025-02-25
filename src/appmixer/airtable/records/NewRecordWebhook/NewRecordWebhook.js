'use strict';

const getLatestUniqueCellValues = (payloads) => {
    const latestRecords = new Map(); // Map to track the latest values by record ID

    payloads.forEach(payload => {
        Object.values(payload.changedTablesById).forEach(table => {
            // Process created records
            if (table.createdRecordsById) {
                Object.entries(table.createdRecordsById).forEach(([recordId, record]) => {
                    latestRecords.set(recordId, record.cellValuesByFieldId);
                });
            }

            // Process changed records
            if (table.changedRecordsById) {
                Object.entries(table.changedRecordsById).forEach(([recordId, record]) => {
                    if (record.current) {
                        latestRecords.set(recordId, record.current.cellValuesByFieldId);
                    }
                });
            }
        });
    });

    return Array.from(latestRecords.values()); // Return as an array of unique cellValuesByFieldId
};

const registerWebhook = async (context) => {

    const { baseId, tableId } = context.properties;
    const { accessToken } = context.auth;
    const body = {
        notificationUrl: context.getWebhookUrl(),
        specification: {
            options: {
                filters: {
                    dataTypes: ['tableData'],
                    recordChangeScope: tableId
                }
            }
        }
    };
    context.log({ step: 'body', body });

    const { data } = await context.httpRequest({
        url: `https://api.airtable.com/v0/bases/${baseId}/webhooks`,
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        method: 'POST',
        data: body
    });

    context.log({ step: 'data', data });

    return data;
};

/**
 * Component which triggers whenever a new file is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        // const { accessToken } = context.auth;
        // const { driveId } = context.properties;
        const state = {
            lastUpdated: Date.now()
        };

        const { id, expirationTime, macSecretBase64 } = await registerWebhook(context);

        state.webhookId = id;
        state.expirationTime = Date.parse(expirationTime);
        state.macSecretBase64 = macSecretBase64;
        state.cursor = 1;

        context.log({ step: 'saving state: ', state });

        return context.saveState(state);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {
        if (context.messages.webhook) {
            const { data: webhookData } = context.messages.webhook.content;
            const { accessToken } = context.auth;
            const webhookId = webhookData.webhook.id;
            const baseId = webhookData.base.id;
            // Airtable is using cursor to tell which was the latest payload requested from webhook
            const state = await context.loadState();

            const { data } = await context.httpRequest({
                url: `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/payloads`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                params: {
                    cursor: state.cursor
                }
            });

            context.log({ step: 'receive webhook payload data', data });

            const { payloads } = data;
            if (Array.isArray(payloads) && payloads.length > 0) {
                let lock;

                try {
                    lock = await context.lock(context.componentId, {
                        ttl: 1000 * 10,
                        retryDelay: 500,
                        maxRetryCount: 3
                    });

                    const latestCellValues = getLatestUniqueCellValues(data.payloads);

                    await context.sendArray(latestCellValues, 'out');
                } finally {
                    await lock?.unlock();
                }


            }

            // calling '/payloads' endpoint should also extend the webhook expiration time by 7 days according to
            // https://airtable.com/developers/web/api/list-webhook-payloads
            const newState = {
                ...state,
                cursor: data.cursor,
                expirationTime: Date.now() + (1000 * 60 * 60 * 24 * 7)
            };
            await context.saveState(newState);

            const {
                webhookId: stateWebhookId,
                expirationTime,
                macSecretBase64,
                cursor: stateCursor,
                lastUpdated
            } = await context.loadState();

            context.log({ step: 'state after all done', stateWebhookId, expirationTime, macSecretBase64, stateCursor, lastUpdated });
            // context.log({ step: 'new expiration time: ', expirationDate: new Date(state.expirationTime).toISOString() });

            return context.response();
        }
    },

    async stop(context) {

        const { accessToken } = context.auth;
        const { baseId } = context.properties;
        const { webhookId } = await context.loadState();

        if (webhookId) {
            await context.httpRequest({
                url: `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}`,
                headers: {
                    Authorization: `Bearer ${accessToken}`
                },
                method: 'DELETE'
            });
        }
    },

    async tick(context) {

        const { accessToken } = context.auth;

        let lock;
        try {
            lock = await context.lock(context.componentId);

            const state = await context.loadState();

            const { webhookId, expirationTime } = state.webhookId;

            context.log({ step: 'tick webhookId', webhookId });
            context.log({ step: 'tick expirationTime', expirationTime });

            if (!webhookId) {
                return;
            }

            // subtract 3 days
            const renewDate = expirationTime - 259200000;
            const now = Date.now();

            if (now >= renewDate) {
                try {

                    const { data } = await context.httpRequest({
                        url: `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/refresh`,
                        headers: {
                            Authorization: `Bearer ${accessToken}`
                        },
                        method: 'POST'
                    });
                    context.log({ step: 'tick httpRequest data', data });

                    state.expiryDate = data.expirationTime;
                } catch (err) {
                    if (err?.statusCode === 404) {
                        const { id, expirationTime } = await registerWebhook(context);
                        state.webhookId = id;
                        state.expirationTime = expirationTime;
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
