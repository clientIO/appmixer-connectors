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
        let query = 'select * from account';

        // Remove extra spaces and line breaks.
        const searchTerm = term?.replace(/\s+/g, ' ').trim();

        if (!searchTerm) {
            // no term, just list all items.
            query = 'select * from account';
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
            records: response.data?.QueryResponse?.Account || []
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'FullyQualifiedName', value: 'FullyQualifiedName' },
                { label: 'domain', value: 'domain' },
                { label: 'Name', value: 'Name' },
                { label: 'Classification', value: 'Classification' },
                { label: 'AccountSubType', value: 'AccountSubType' },
                {
                    label: 'CurrencyRef', value: 'CurrencyRef',
                    schema: {
                        type: 'object',
                        properties: {
                            name: { label: 'name', value: 'name' }, value: { label: 'value', value: 'value' }
                        }
                    }
                },
                { label: 'CurrentBalanceWithSubAccounts', value: 'CurrentBalanceWithSubAccounts' },
                { label: 'sparse', value: 'sparse' },
                {
                    label: 'MetaData', value: 'MetaData',
                    schema: {
                        type: 'object',
                        properties: {
                            CreateTime: { label: 'CreateTime', value: 'CreateTime' },
                            LastUpdatedTime: { label: 'LastUpdatedTime', value: 'LastUpdatedTime' }
                        }
                    }
                },
                { label: 'AccountType', value: 'AccountType' },
                { label: 'CurrentBalance', value: 'CurrentBalance' },
                { label: 'Active', value: 'Active' },
                { label: 'SyncToken', value: 'SyncToken' },
                { label: 'Id', value: 'Id' },
                { label: 'SubAccount', value: 'SubAccount' }
            ], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{ label: 'Items', value: 'items',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            FullyQualifiedName: { type: 'string', title: 'FullyQualifiedName' },
                            domain: { type: 'string', title: 'domain' },
                            Name: { type: 'string', title: 'Name' },
                            Classification: { type: 'string', title: 'Classification' },
                            AccountSubType: { type: 'string', title: 'AccountSubType' },
                            CurrencyRef: {
                                type: 'object',
                                title: 'CurrencyRef',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        name: { label: 'name', value: 'name' },
                                        value: { label: 'value', value: 'value' }
                                    }
                                }
                            },
                            CurrentBalanceWithSubAccounts: { type: 'number', title: 'CurrentBalanceWithSubAccounts' },
                            sparse: { type: 'boolean', title: 'sparse' },
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
                            },
                            AccountType: { type: 'string', title: 'AccountType' },
                            CurrentBalance: { type: 'number', title: 'CurrentBalance' },
                            Active: { type: 'boolean', title: 'Active' },
                            SyncToken: { type: 'string', title: 'SyncToken' },
                            Id: { type: 'string', title: 'Id' },
                            SubAccount: { type: 'boolean', title: 'SubAccount' }
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
