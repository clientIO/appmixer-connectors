'use strict';

const { transformFieldstoBodyFields } = require('../../airtable-commons');

module.exports = {

    async receive(context) {
        const {
            baseId, tableId, fieldsToMergeOn,
            returnFieldsByFieldId = false, typecast = false
        } = context.properties;
        const { accessToken } = context.auth;
        const fields = context.messages.in.content;
        const { recordId } = fields;

        if (fieldsToMergeOn.length > 3) {
            throw new context.CancelError('Cannot have more than 3 fields selected in Merge Fields.');
        }

        const bodyFields = transformFieldstoBodyFields(fields);

        const body = {
            returnFieldsByFieldId,
            typecast,
            performUpsert: {
                fieldsToMergeOn
            },
            records: [{ fields: bodyFields, id: recordId }]
        };

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableId}`,
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}` },
            data: body
        });

        const outputRecord = {
            action: data.createdRecords.includes(data.records[0].id) ? 'created' : 'updated',
            id: data.records[0].id,
            createdTime: data.records[0].createdTime,
            ...data.records[0].fields
        };

        context.sendJson(outputRecord, 'out');
    }
};
