'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');

module.exports = {

    async receive(context) {

        const { projectId, datasetId, tableId } = context.messages.in.content;

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const dataset = client.dataset(datasetId);
        const [table] = await dataset.table(tableId).get()

        return context.sendJson({ table }, 'out')
    }
};
