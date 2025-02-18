'use strict';

const Airtable = require('airtable');

module.exports = {

    async tick(context) {
        const {
            baseId, tableIdOrName,
            triggerField = 'Created',
            view
        } = context.properties;

        let { createdTime } = await context.loadState();

        const now = Date.now();

        if (!createdTime) {
            createdTime = now;
        }

        Airtable.configure({
            endpointUrl: 'https://api.airtable.com',
            apiKey: context.auth.accessToken
        });
        const base = Airtable.base(baseId);

        const queryParams = {
            filterByFormula: `AND(NOT({${triggerField}} = BLANK()))`,
            sort: [{ field: triggerField, direction: 'desc' }]
        };
        if (view) {
            queryParams.view = view;
        }

        const all = await base(tableIdOrName).select(queryParams).all();
        const items = all.map(item => {
            const record = {
                // eslint-disable-next-line no-underscore-dangle
                createdTime: item.fields[triggerField],
                fields: item.fields,
                id: item.id
            };

            return record;
        });
        context.log({ step: 'items', items });

        let latestRecordCreateDate;
        if (Array.isArray(items) && items.length > 0) {
            latestRecordCreateDate = new Date(items[0].createdTime).valueOf();
            const onlyNewRecords = items.filter(r => {
                return new Date(r.createdTime).valueOf() > createdTime;
            });

            for (const item of onlyNewRecords) {
                await context.sendJson(item, 'out');
            }

        }

        return context.saveState({ createdTime: latestRecordCreateDate ?? now });
    }
};
