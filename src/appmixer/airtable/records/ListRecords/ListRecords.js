'use strict';

const { sendArrayOutput } = require('../../airtable-commons');

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const {
            baseId, tableIdOrName,
            // Optional query params
            fields,
            filterByFormula,
            maxRecords = 10000,
            sort,
            view,
            recordMetadata,
            // Appmixer specific
            outputType
        } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const queryParams = {
            // If not provided by user, use our default value.
            maxRecords,
            // If not provided by user, use our default value json.
            cellFormat: 'json'
        };
        if (fields) {
            queryParams.fields = fields.trim().split(',');
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
        if (recordMetadata) {
            // This one works only with ['commentCount'].
            queryParams.recordMetadata = ['commentCount'];
        }
        context.log({ step: 'queryParams', queryParams });

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableIdOrName}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
            params: queryParams
        });
        const items = data.map(item => {
            const record = {
                // eslint-disable-next-line no-underscore-dangle
                createdTime: item.createdTime,
                fields: item.fields,
                id: item.id
            };

            if (recordMetadata) {
                record.commentCount = item.commentCount;
            }

            return record;
        });

        await sendArrayOutput({ context, outputType, records: items });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object') {
            return context.sendJson(
                [
                    { label: 'Created Time', value: 'createdTime' },
                    {
                        label: 'Fields', value: 'fields',
                        // We can't know table columns beforehand, so we'll just use empty object as schema.
                        schema: { type: 'object' }
                    },
                    { label: 'ID', value: 'id' },
                    { label: 'Comment Count', value: 'commentCount' }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    {
                        label: 'Records', value: 'result',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    createdTime: { type: 'string', title: 'createdTime' },
                                    fields: {
                                        type: 'object', title: 'fields',
                                        // We can't know table columns beforehand, so we'll just use empty object as schema.
                                        schema: { type: 'object' }
                                    },
                                    id: { type: 'string', title: 'id' },
                                    commentCount: { type: 'number', title: 'commentCount' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
