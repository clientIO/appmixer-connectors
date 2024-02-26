'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');

async function streamingInsert(context) {

    const {
        projectId,
        datasetId,
        tableId,
        createDisposition,
        writeDisposition,
        timePartition,
        timePartitionField,
        clusteringFields
    } = context.messages.in.content;

    const queryOptions = {
        createDisposition,
        writeDisposition,
        timePartition,
        timePartitionField,
        clusteringFields
    };
    const optionKeys = Object.keys(queryOptions);

    let client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    // eslint-disable-next-line no-unused-vars
    const [table] = await client.dataset(datasetId).table(tableId).get();

    const excludedKeys = [
        'projectId',
        'datasetId',
        'tableId',
        'insertMode',
        ...optionKeys
    ];

    const row = Object.entries(context.messages.in.content).reduce((acc, [key, value]) => {
        if (!excludedKeys.includes(key)) {
            acc[key] = value;
        }
        return acc;
    }, {});

    client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    await client.dataset(datasetId).table(tableId).insert(row);

    return context.sendJson({ row }, 'out');
}

async function writeInsert(context) {

    const {
        projectId,
        datasetId,
        tableId,
        createDisposition,
        writeDisposition,
        timePartition,
        timePartitionField,
        clusteringFields
    } = context.messages.in.content;

    const queryOptions = {
        createDisposition,
        writeDisposition,
        timePartition,
        timePartitionField,
        clusteringFields
    };
    const optionKeys = Object.keys(queryOptions);

    let client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    const [table] = await client.dataset(datasetId).table(tableId).get();

    const { schema } = table.metadata;

    const excludedKeys = [
        'projectId',
        'datasetId',
        'tableId',
        'insertMode',
        ...optionKeys
    ];

    const row = Object.entries(context.messages.in.content).reduce((acc, [key, value]) => {
        if (!excludedKeys.includes(key)) {
            acc[key] = value;
        }
        return acc;
    }, {});

    const timePartitionOptions = timePartition
        ? { timePartitioning: { type: timePartition, field: timePartitionField } }
        : {};

    const clusteringOptions = clusteringFields && clusteringFields.length
        ? { fields: clusteringFields }
        : {};

    client = new BigQuery({
        authClient: commons.getAuthLibraryOAuth2Client(context.auth),
        projectId
    });

    const tableRef = client.dataset(datasetId).table(tableId);

    return new Promise((resolve, reject) => {
        const writeStream = tableRef.createWriteStream({
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            schema,
            createDisposition,
            writeDisposition,
            timePartitionOptions,
            clusteringOptions
        }).on('complete', async (job) => {
            // The job has completed successfully.
            await context.sendJson({ row }, 'out');
            resolve(job);
        }).on('error', err => {
            reject(err);
        });

        writeStream.end(JSON.stringify(row));
    });
}

module.exports = {

    async receive(context) {

        const { insertMode } = context.messages.in.content;

        if (insertMode === 'streaming') {
            await streamingInsert(context);
        } else {
            await writeInsert(context);
        }
    }
};
