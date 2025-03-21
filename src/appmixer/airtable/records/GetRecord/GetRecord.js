'use strict';

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        const { baseId, tableIdOrName, recordId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableIdOrName}/${recordId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        context.log({ step: 'responseData', data });

        const outputRecord = {
            id: data.id,
            createdTime: data.createdTime,
            ...data.fields
        };

        context.sendJson(outputRecord, 'out');
    }
};
