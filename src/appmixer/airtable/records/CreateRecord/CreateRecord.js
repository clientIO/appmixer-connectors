'use strict';

const { transformFieldstoBodyFields } = require('../../airtable-commons');

module.exports = {

    async receive(context) {
        const {
            baseId, tableId,
            returnFieldsByFieldId = false, typecast = false
        } = context.properties;
        const { accessToken } = context.auth;
        const fields = context.messages.in.content;

        const bodyFields = transformFieldstoBodyFields(fields);

        const body = {
            returnFieldsByFieldId,
            typecast,
            fields: bodyFields
        };

        context.log({ step: 'createRequestBody', body });

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableId}`,
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            data: body
        });

        const outputRecord = {
            id: data.id,
            createdTime: data.createdTime,
            ...data.fields
        };

        context.sendJson(outputRecord, 'out');
    }
};
