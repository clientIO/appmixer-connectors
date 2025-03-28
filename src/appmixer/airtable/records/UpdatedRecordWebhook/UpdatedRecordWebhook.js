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
                    changeTypes: ['update']
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
            const stateTimeout = await context.stateGet('timeout');
            if (!stateTimeout) {
                await context.setTimeout({}, 5000);
                await context.stateSet('timeout', true);
            }
            return context.response();
        }

        if (context.messages.timeout) {
            await context.stateSet('timeout', false);
            const { baseId, tableId } = context.properties;
            const { accessToken } = context.auth;
            const state = await context.loadState();
            const webhookId = state.webhookId;

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
                const recordIds = [];

                payloads.forEach((payload) => {
                    const changedRecordIds = Object.keys(payload.changedTablesById[tableId].changedRecordsById);
                    changedRecordIds.forEach((recordId) => {
                        recordIds.push(recordId);
                    });
                });

                const uniqueRecordIds = [...new Set(recordIds)];

                let formula = '';
                if (uniqueRecordIds.length === 1) {
                    formula = `RECORD_ID()='${uniqueRecordIds[0]}'`;
                } else {
                    formula = 'OR(' + uniqueRecordIds.map(id => { return `RECORD_ID()='${id}'`; }).join(',') + ')';
                }

                const { data: records } = await context.httpRequest({
                    url: `https://api.airtable.com/v0/${baseId}/${tableId}/listRecords`,
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    },
                    data: {
                        filterByFormula: formula
                    }
                });



                const updatedRecords = records.records.map((record) => {
                    return {
                        id: record.id,
                        createdTime: record.createdTime,
                        ...record.fields
                    };
                });

                await context.sendArray(updatedRecords, 'out');
            }
            // calling '/payloads' endpoint should also extend the webhook expiration time by 7 days according to
            // https://airtable.com/developers/web/api/list-webhook-payloads
            const newState = {
                ...state,
                cursor: data.cursor,
                expirationTime: Date.now() + (1000 * 60 * 60 * 24 * 7)
            };
            await context.saveState(newState);
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

                    state.expirationTime = Date.parse(data.expirationTime);
                } catch (err) {
                    if (err?.statusCode === 404) {
                        const { id, expirationTime } = await registerWebhook(context);
                        state.webhookId = id;
                        state.expirationTime = Date.parse(expirationTime);
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
    },

    tablesSelectArray({ items }) {

        return items.map(table => {
            return { label: table.name, value: table.id };
        });
    },
};
