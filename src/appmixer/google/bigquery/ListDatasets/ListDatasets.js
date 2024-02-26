'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');

module.exports = {

    async receive(context) {

        const { projectId } = context.messages.in.content;

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const [ datasets ] = await client.getDatasets();
        return context.sendJson({ datasets }, 'out')
    },

    toSelectArray({ datasets }) {

        return datasets.map(d => ({ label: d.id, value: d.id }));
    }
};
