'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }

        const { projectId, datasetId, outputType } = context.messages.in.content;

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const [tables] = await client.dataset(datasetId).getTables();
        // Metadata only as in https://cloud.google.com/bigquery/docs/reference/rest/v2/tables/list
        const metadata = tables.map(d => d.metadata);
        await commons.sendArrayOutput({ context, outputType, records: metadata });
    },

    toSelectArray({ items }) {
        const tableIds = items.map(d => d.tableReference?.tableId);
        return tableIds.map(tableId => ({ label: tableId, value: tableId }));
    },

    /**
 * Returns options for ListTables output port depending on outputType.
 * @param {Context} context
 */
    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        if (outputType === 'item') {
            return context.sendJson([{
                name: 'out',
                options: [
                    { label: 'kind', value: 'kind' },
                    { label: 'id', value: 'id' },
                    {
                        label: 'tableReference', value: 'tableReference',
                        schema: {
                            type: 'object',
                            properties: {
                                projectId: { label: 'projectId', value: 'projectId' },
                                datasetId: { label: 'datasetId', value: 'datasetId' },
                                tableId: { label: 'tableId', value: 'tableId' }
                            }
                        }
                    },
                    { label: 'type', value: 'type' },
                    { label: 'creationTime', value: 'creationTime' },
                    { label: 'expirationTime', value: 'expirationTime' }
                ]
            }], 'out');
        }

        if (outputType === 'items') {

            return context.sendJson([{
                label: 'Items', value: 'items',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            kind: { type: 'string', title: 'kind' },
                            id: { type: 'string', title: 'id' },
                            tableReference: {
                                type: 'object', title: 'tableReference',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        projectId: { label: 'projectId', value: 'projectId' },
                                        datasetId: { label: 'datasetId', value: 'datasetId' },
                                        tableId: { label: 'tableId', value: 'tableId' }
                                    }
                                }
                            },
                            type: { type: 'string', title: 'type' },
                            creationTime: { type: 'string', title: 'creationTime' },
                            expirationTime: { type: 'string', title: 'expirationTime' }
                        }
                    }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }

        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
};
