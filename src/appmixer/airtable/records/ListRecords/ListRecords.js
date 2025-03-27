'use strict';

const { sendArrayOutput } = require('../../airtable-commons');

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        context.log({ step: 'accessToken', accessToken });
        const { baseId, tableId } = context.properties;
        const {
            // Optional query params
            fields,
            filterByFormula,
            sort,
            view,
            // Appmixer specific
            outputType
        } = context.messages.in.content;

        const queryParams = {
            cellFormat: 'json'
        };
        if (fields) {
            queryParams.fields = fields.length > 0 ? fields : undefined;
        }
        if (filterByFormula) {
            queryParams.filterByFormula = filterByFormula.trim();
        }
        if (sort) {
            try {
                queryParams.sort = JSON.parse(sort);
            } catch (e) {
                // noop
                context.log({ step: 'sort', error: e });
            }
        }
        if (view) {
            queryParams.view = view;
        }
        context.log({ step: 'queryParams', queryParams });

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
            params: queryParams
        });
        context.log({ step: 'response data', data });

        const { records } = data;

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        const items = records.map(item => {
            const record = {
                id: item.id,
                createdTime: item.createdTime,
                ...item.fields
            };

            return record;
        });

        await sendArrayOutput({ context, outputType, records: items });
    }
};
