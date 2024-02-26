'use strict';

const { BigQuery } = require('@google-cloud/bigquery');
const commons = require('../../google-commons');

module.exports = {

    async receive(context) {

        const {
            projectId,
            datasetId,
            tableId,
            insertMode,
            timePartition
        } = context.properties;

        let table;

        if (tableId) {

            const client = new BigQuery({
                authClient: commons.getAuthLibraryOAuth2Client(context.auth),
                projectId
            });

            const dataset = client.dataset(datasetId);
            [table] = await dataset.table(tableId).get();
        }

        const inputValues = {
            insertMode,
            timePartition
        };

        return context.sendJson({ table, inputValues }, 'out');
    },

    addRowInspector({ table, inputValues }) {

        const schema = {
            type: 'object',
            properties: {
                projectId: { type: 'string' },
                datasetId: { type: 'string' },
                tableId: { type: 'string' },
                insertMode: { type: 'string' }
            },
            required: ['projectId', 'datasetId', 'tableId', 'insertMode']
        };

        let inputs = {
            projectId: {
                'type': 'select',
                'label': 'Project ID',
                'index': 1,
                'source': {
                    'url': '/component/appmixer/google/bigquery/ListProjects?outPort=out',
                    'data': {
                        'transform': './ListProjects#toSelectArray'
                    }
                },
                'tooltip': 'Select the target project.'
            },
            datasetId: {
                type: 'select',
                label: 'Dataset',
                index: 2,
                source: {
                    url: '/component/appmixer/google/bigquery/ListDatasets?outPort=out',
                    data: {
                        messages: {
                            'in/projectId': 'inputs/in/projectId'
                        },
                        transform: './ListDatasets#toSelectArray'
                    }
                },
                tooltip: 'Select the target dataset.'
            },
            tableId: {
                type: 'select',
                label: 'Table',
                index: 3,
                source: {
                    url: '/component/appmixer/google/bigquery/ListTables?outPort=out',
                    data: {
                        messages: {
                            'in/projectId': 'inputs/in/projectId',
                            'in/datasetId': 'inputs/in/datasetId'
                        },
                        transform: './ListTables#toSelectArray'
                    }
                },
                tooltip: 'Select the target table.'
            },
            insertMode: {
                type: 'select',
                label: 'Insert mode',
                index: 4,
                options: [
                    { label: 'Streaming', value: 'streaming' },
                    { label: 'Job', value: 'job' }
                ],
                tooltip: 'Select the mode to use for inserting the row. If Job is used, a job will be used to insert the row into the table. ' +
                    'This mode allows to specify additional configuration, like create and write dispositions, ' +
                    'clustering fields and time partitioning. Additionally, the rows inserted this way can be ' +
                    'updated or deleted at any time. The downside, is that the quota is just 1500 operations a day. If Streaming ' +
                    'is used, the BigQuery streaming API will be used, which has a much higher quota, but in turn, rows inserted this ' +
                    'way cannot be modified before 30 minutes of being added and the additional configurations are not available.',
                defaultValue: 'streaming'

            }
        };

        let groups = {};

        if (table) {
            const { fields } = table.metadata.schema;

            fields.forEach((field) => {
                const entry = createSchemaField(field);
                schema.properties[entry.name] = entry.inputDefinition;
            });

            fields.forEach((field, idx) => {
                const entry = createInput(idx + 5, field);
                inputs[entry.name] = entry.inputDefinition;
            });

            if (inputValues.insertMode === 'job') {
                inputs = {
                    ...inputs,
                    createDisposition: {
                        type: 'select',
                        index: 1,
                        label: 'Create disposition',
                        options: [
                            { label: 'Create if needed', value: 'CREATE_IF_NEEDED' },
                            { label: 'Create never', value: 'CREATE_NEVER' }
                        ],
                        defaultValue: 'CREATE_IF_NEEDED',
                        tooltip: 'Select the table create disposition',
                        group: 'options'
                    },
                    writeDisposition: {
                        type: 'select',
                        index: 2,
                        label: 'Write disposition',
                        options: [
                            { label: 'Write append', value: 'WRITE_APPEND' },
                            { label: 'Write truncate', value: 'WRITE_TRUNCATE' },
                            { label: 'Write empty', value: 'WRITE_EMPTY' }
                        ],
                        defaultValue: 'WRITE_APPEND',
                        tooltip: 'Select the table write disposition',
                        group: 'options'
                    },
                    timePartition: {
                        type: 'select',
                        index: 3,
                        label: 'Time Partitioning',
                        options: [
                            { 'clearItem': true, 'content': '-- Clear selection --' },
                            { label: 'Hour', value: 'HOUR' },
                            { label: 'Day', value: 'DAY' },
                            { label: 'Month', value: 'MONTH' },
                            { label: 'Year', value: 'YEAR' }
                        ],
                        tooltip: 'Select a time partition to use',
                        group: 'options'
                    }
                };

                if (inputValues.timePartition) {
                    inputs.timePartitionField = {
                        type: 'select',
                        index: 4,
                        label: 'Time partitioning field',
                        options: fields.filter(field => ['TIMESTAMP', 'DATETIME', 'DATE', 'TIME'].includes(field.type))
                            .map(field => ({ label: field.name, value: field.name })),
                        tooltip: 'Select the field to use for time partitioning',
                        group: 'options'
                    };
                }

                inputs.clusteringFields = {
                    type: 'multiselect',
                    index: 5,
                    label: 'Clustering fields',
                    options: fields.map(field => ({ label: field.name, value: field.name })),
                    tooltip: 'Select clustering fields',
                    group: 'options'
                };
            }

            groups = {
                fields: {
                    label: 'Fields',
                    index: 2
                },
                options: {
                    label: 'Options',
                    index: 3
                }
            };
        }

        return {
            schema,
            inputs,
            groups
        };

    }
};

function createSchemaField(inputSchema) {

    const fieldMap = {
        'STRING': { type: 'string' },
        'BYTES': { type: 'string' },
        'FLOAT': { type: 'number' },
        'NUMERIC': { type: 'number' },
        'BIGNUMERIC': { type: 'number' },
        'BOOLEAN': { type: 'boolean' },
        'TIMESTAMP': { type: 'number' },
        'DATE': { type: 'string' },
        'TIME': { type: 'string' },
        'DATETIME': { type: 'string' },
        'GEOGRAPHY': { type: 'string' },
        'RECORD': { type: 'string' },
        'INTEGER': { type: 'number' }
    };

    return {
        name: inputSchema.name,
        inputDefinition: {
            type: fieldMap[inputSchema.type].type
        }
    };
}

function createInput(idx, inputSchema) {

    const fieldMap = {
        'STRING': { input: 'text' },
        'BYTES': { input: 'filepicker' },
        'FLOAT': { input: 'number' },
        'NUMERIC': { input: 'number' },
        'BIGNUMERIC': { input: 'number' },
        'BOOLEAN': { input: 'toggle' },
        'TIMESTAMP': { input: 'number' },
        'DATE': { input: 'datetime' },
        'TIME': { input: 'text' },
        'DATETIME': { input: 'datetime' },
        'GEOGRAPHY': { input: 'text' },
        'RECORD': { input: 'text' },
        'INTEGER': { input: 'number' }
    };

    return {
        name: inputSchema.name,
        inputDefinition: {
            label: inputSchema.name,
            index: idx,
            type: fieldMap[inputSchema.type].input,
            group: 'fields'
        }
    };
}
