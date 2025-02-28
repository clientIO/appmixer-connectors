'use strict';

const registerWebhook = async (context) => {

    const { baseId, tableId } = context.properties;
    const { accessToken } = context.auth;
    const body = {
        notificationUrl: context.getWebhookUrl(),
        specification: {
            options: {
                filters: {
                    dataTypes: ['tableData'],
                    recordChangeScope: tableId,
                    changeTypes: ['add']
                }
            }
        }
    };

    const { data } = await context.httpRequest({
        url: `https://api.airtable.com/v0/bases/${baseId}/webhooks`,
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        method: 'POST',
        data: body
    });

    return data;
};

/**
 * Component which triggers whenever a new file is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {
        const state = {
            lastUpdated: Date.now()
        };

        const { id, expirationTime, macSecretBase64 } = await registerWebhook(context);

        state.webhookId = id;
        state.expirationTime = Date.parse(expirationTime);
        state.macSecretBase64 = macSecretBase64;
        state.cursor = 1;

        return context.saveState(state);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {
        if (context.messages.webhook) {
            const { tableId } = context.properties;
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

            const { payloads } = data;
            if (Array.isArray(payloads) && payloads.length > 0) {
                const allNewRecordIds = Object.keys(payloads[0].changedTablesById[tableId].createdRecordsById);
                const firstCreatedRecordTime = Date.parse(
                    payloads[0].changedTablesById[tableId].createdRecordsById[allNewRecordIds[0]].createdTime
                );
                const firstCreatedRecordMinusMillisecond = firstCreatedRecordTime - 1;
                const timeForFilterFormula = new Date(firstCreatedRecordMinusMillisecond).toISOString();
                const { data: records } = await context.httpRequest({
                    url: `https://api.airtable.com/v0/${baseId}/${tableId}`,
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    },
                    params: {
                        filterByFormula: `IS_AFTER(CREATED_TIME(),"${timeForFilterFormula}")`
                    }
                });

                await context.sendJson(records.records, 'out');
            }

            // calling '/payloads' endpoint should also extend the webhook expiration time by 7 days according to
            // https://airtable.com/developers/web/api/list-webhook-payloads
            const newState = {
                ...state,
                cursor: data.cursor,
                expirationTime: Date.now() + (1000 * 60 * 60 * 24 * 7)
            };
            await context.saveState(newState);

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
        const { baseId } = context.properties;

        let lock;
        try {
            lock = await context.lock(context.componentId);

            const state = await context.loadState();

            const { webhookId, expirationTime } = state;

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

                    state.expirationTime = data.expirationTime;
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
