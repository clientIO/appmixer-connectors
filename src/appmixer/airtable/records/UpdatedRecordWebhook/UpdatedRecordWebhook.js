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
        state.jsTimeout = false;

        return context.saveState(state);
    },

    /**
     * @param {Context} context
     * @return {*}
     */
    async receive(context) {
        if (context.messages.webhook) {
            const { tableId } = context.properties;
            //context.log({ step: 'contextMessagesWebhookContent value', content: context.messages.webhook.content });
            const { data: webhookData } = context.messages.webhook.content;
            const { accessToken } = context.auth;
            const webhookId = webhookData.webhook.id;
            const baseId = webhookData.base.id;
            // Airtable is using cursor to tell which was the latest payload requested from webhook
            const state = await context.loadState();
            let jsTimeout = state.jsTimeout;

            //const statePayloads = await context.stateGet('payloads') || [];
            // const stateTimeout = await context.stateGet('timeout') || false;
            // if (!stateTimeout) {
            //     context.log({ step: 'timeout', start: 'timeout started' });
            //     await context.stateSet('test', 'testValue');
            //     await context.setTimeout({}, 5000);
            //     await context.stateSet('timeout', true);
            // }
            // context.log({ step: 'contextMessagesTimeout value', innerValue: context.messages.timeout });
            if (!jsTimeout) {
                context.log({ step: 'timeoutStarted', start: 'timeout started' });
                await context.saveState({
                    ...state,
                    jsTimeout: true
                });
                const jsTimeout2 = setTimeout(async () => {
                    context.log({ step: 'timeouExpired', start: 'timeout expired' });
                    context.log({ step: 'contextMessagesTimeout', timeoutReceived: 'contextMessagesTimeout received' });
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

                        //await context.stateSet('payloads', payloads.concat(statePayloads));

                        context.log({ step: 'updatedPayloads', payloads });
                        const recordIds = [];

                        payloads.forEach((payload) => {
                            const changedRecordIds = Object.keys(payload.changedTablesById[tableId].changedRecordsById);
                            changedRecordIds.forEach((recordId) => {
                                recordIds.push(recordId);
                            });
                        });
                        const uniqueRecordIds = [...new Set(recordIds)];

                        context.log({ step: 'recordIds', recordIds });
                        context.log({ step: 'uniqueRecordIds', uniqueRecordIds });

                        let formula = '';
                        if (uniqueRecordIds.length === 1) {
                            formula = `RECORD_ID()='${uniqueRecordIds[0]}'`;
                        } else {
                            formula = 'OR(' + uniqueRecordIds.map(id => { return `RECORD_ID()='${id}'`; }).join(',') + ')';
                        }

                        context.log({ step: 'filterByFormula', formula });

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


                        context.log({ step: 'updatedRecords', records });

                        const newRecords = records.records.map((record) => {
                            return {
                                id: record.id,
                                createdTime: record.createdTime,
                                ...record.fields
                            };
                        });

                        await context.sendArray(payloads, 'out');
                        //await context.stateUnset('payloads');


                    }
                    await context.saveState({
                        ...state,
                        jsTimeout: false
                    });
                    //await context.stateSet('timeout', false);
                    clearTimeout(jsTimeout2);

                    // calling '/payloads' endpoint should also extend the webhook expiration time by 7 days according to
                    // https://airtable.com/developers/web/api/list-webhook-payloads
                    const newState = {
                        ...state,
                        cursor: data.cursor,
                        expirationTime: Date.now() + (1000 * 60 * 60 * 24 * 7)
                    };
                    await context.saveState(newState);
                    return context.response();
                }, 15000);
                //await context.stateSet('timeout', true);
            }
            //context.log({ step: 'state', state });


            //if (context.messages.timeout) {
            // context.log({ step: 'contextMessagesTimeout', timeoutReceived: 'contextMessagesTimeout received' });
            // const { data } = await context.httpRequest({
            //     url: `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/payloads`,
            //     method: 'GET',
            //     headers: {
            //         Authorization: `Bearer ${accessToken}`
            //     },
            //     params: {
            //         cursor: state.cursor
            //     }
            // });

            // const { payloads } = data;
            // if (Array.isArray(payloads) && payloads.length > 0) {

            //     await context.stateSet('payloads', payloads.concat(statePayloads));

            //     context.log({ step: 'updatedPayloads', payloads });
            //     const recordIds = [];

            //     statePayloads.forEach((payload) => {
            //         const changedRecordIds = Object.keys(payload.changedTablesById[tableId].changedRecordsById);
            //         changedRecordIds.forEach((recordId) => {
            //             recordIds.push(recordId);
            //         });
            //     });
            //     const uniqueRecordIds = [...new Set(recordIds)];

            //     context.log({ step: 'recordIds', recordIds });

            //     let formula = '';
            //     if (uniqueRecordIds.length === 1) {
            //         formula = `RECORD_ID()='${uniqueRecordIds[0]}'`;
            //     } else {
            //         formula = 'OR(' + uniqueRecordIds.map(id => { return `RECORD_ID()='${id}'`; }).join(',') + ')';
            //     }

            //     context.log({ step: 'filterByFormula', formula });

            //     const { data: records } = await context.httpRequest({
            //         url: `https://api.airtable.com/v0/${baseId}/${tableId}/listRecords`,
            //         method: 'POST',
            //         headers: {
            //             Authorization: `Bearer ${accessToken}`
            //         },
            //         data: {
            //             filterByFormula: formula
            //         }
            //     });


            //     context.log({ step: 'updatedRecords', records });

            //     const newRecords = records.records.map((record) => {
            //         return {
            //             id: record.id,
            //             createdTime: record.createdTime,
            //             ...record.fields
            //         };
            //     });

            //     await context.sendArray(payloads, 'out');
            //     await context.stateUnset('payloads');

            // }
            // //await context.stateSet('timeout', false);
            // clearTimeout(jsTimeout);

            // // calling '/payloads' endpoint should also extend the webhook expiration time by 7 days according to
            // // https://airtable.com/developers/web/api/list-webhook-payloads
            // const newState = {
            //     ...state,
            //     cursor: data.cursor,
            //     expirationTime: Date.now() + (1000 * 60 * 60 * 24 * 7)
            // };
            // await context.saveState(newState);
            //}

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
