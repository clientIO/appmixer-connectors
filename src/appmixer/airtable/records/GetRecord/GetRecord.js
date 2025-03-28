'use strict';

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        const { baseId, tableId } = context.properties;
        const { recordId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const outputRecord = {
            id: data.id,
            createdTime: data.createdTime,
            ...data.fields
        };

        context.sendJson(outputRecord, 'out');
    }
};
