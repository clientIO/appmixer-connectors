'use strict';
const { makeRequest, sendArrayOutput } = require('../../commons');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { searchType, minorVersion, term, maxResults, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        /** A query for filtering the results. */
        let query = 'select * from class';

        // Remove extra spaces and line breaks.
        const searchTerm = term?.replace(/\s+/g, ' ').trim();

        if (!searchTerm) {
            // no term, just list all items.
            query = 'select * from class';
        } else if (searchType === 'nameEquals') {
            query += ` where name='${searchTerm}'`;
        } else if (searchType === 'nameContains') {
            query += ` where name like '%${searchTerm}%'`;
        } else {
            query += ` where ${searchTerm}`;
        }
        if (maxResults) {
            query += ` maxresults ${maxResults}`;
        }

        await context.log({ step: 'Preparing query parameter', query });

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/query?minorversion=${minorVersion}&query=${encodeURIComponent(query)}`,
            method: 'GET'
        };
        const response = await makeRequest({ context, options });

        return sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: response.data?.QueryResponse?.Class || []
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'Name', value: 'Name' },
                { label: 'SubClass', value: 'SubClass' },
                { label: 'FullyQualifiedName', value: 'FullyQualifiedName' },
                { label: 'Active', value: 'Active' },
                { label: 'domain', value: 'domain' },
                { label: 'sparse', value: 'sparse' },
                { label: 'Id', value: 'Id' },
                { label: 'SyncToken', value: 'SyncToken' },
                {
                    label: 'MetaData', value: 'MetaData',
                    schema: {
                        type: 'object',
                        properties: {
                            CreateTime: { label: 'CreateTime', value: 'CreateTime' },
                            LastUpdatedTime: { label: 'LastUpdatedTime', value: 'LastUpdatedTime' }
                        }
                    }
                }
            ], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{
                label: 'Items',
                value: 'items',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            Name: { type: 'string', title: 'Name' },
                            SubClass: { type: 'boolean', title: 'SubClass' },
                            FullyQualifiedName: { type: 'string', title: 'FullyQualifiedName' },
                            Active: { type: 'boolean', title: 'Active' },
                            domain: { type: 'string', title: 'domain' },
                            sparse: { type: 'boolean', title: 'sparse' },
                            Id: { type: 'string', title: 'Id' },
                            SyncToken: { type: 'string', title: 'SyncToken' },
                            MetaData: {
                                type: 'object',
                                title: 'MetaData',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        CreateTime: { label: 'CreateTime', value: 'CreateTime' },
                                        LastUpdatedTime: { label: 'LastUpdatedTime', value: 'LastUpdatedTime' }
                                    }
                                }
                            }
                        }
                    }
                }
            }], 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
