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
        let query = 'select * from JournalEntry';

        // Remove extra spaces and line breaks.
        const searchTerm = term?.replace(/\s+/g, ' ').trim();

        if (!searchTerm) {
            // no term, just list all items.
            query = 'select * from JournalEntry';
        } else if (searchType === 'docNumberEquals') {
            query += ` where docNumber='${searchTerm}'`;
        } else if (searchType === 'docNumberContains') {
            query += ` where docNumber like '%${searchTerm}%'`;
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
            records: response.data?.QueryResponse?.JournalEntry || []
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'SyncToken', value: 'SyncToken' },
                { label: 'domain', value: 'domain' },
                { label: 'TxnDate', value: 'TxnDate' },
                { label: 'PrivateNote', value: 'PrivateNote' },
                { label: 'sparse', value: 'sparse' },
                {
                    label: 'Line', value: 'Line',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                JournalEntryLineDetail: {
                                    label: 'JournalEntryLineDetail', value: 'JournalEntryLineDetail',
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            PostingType: { label: 'PostingType', value: 'PostingType' },
                                            AccountRef: {
                                                label: 'AccountRef', value: 'AccountRef',
                                                schema: {
                                                    type: 'object',
                                                    properties: {
                                                        name: { label: 'name', value: 'name' },
                                                        value: { label: 'value', value: 'value' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                DetailType: { label: 'DetailType', value: 'DetailType' },
                                Amount: { label: 'Amount', value: 'Amount' },
                                Id: { label: 'Id', value: 'Id' },
                                Description: { label: 'Description', value: 'Description' }
                            }
                        }
                    }
                },
                { label: 'Adjustment', value: 'Adjustment' },
                { label: 'Id', value: 'Id' },
                {
                    label: 'TxnTaxDetail', value: 'TxnTaxDetail',
                    schema: {
                        type: 'object',
                        properties: {}
                    }
                },
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
                label: 'Items', value: 'items',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            SyncToken: { type: 'string', title: 'SyncToken' },
                            domain: { type: 'string', title: 'domain' },
                            TxnDate: { type: 'string', title: 'TxnDate' },
                            PrivateNote: { type: 'string', title: 'PrivateNote' },
                            sparse: { type: 'boolean', title: 'sparse' },
                            Line: {
                                type: 'object',
                                title: 'Line',
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            JournalEntryLineDetail: {
                                                label: 'JournalEntryLineDetail', value: 'JournalEntryLineDetail',
                                                schema: {
                                                    type: 'object',
                                                    properties: {
                                                        PostingType: { label: 'PostingType', value: 'PostingType' },
                                                        AccountRef: {
                                                            label: 'AccountRef', value: 'AccountRef',
                                                            schema: {
                                                                type: 'object',
                                                                properties: {
                                                                    name: { label: 'name', value: 'name' },
                                                                    value: { label: 'value', value: 'value' }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            DetailType: { label: 'DetailType', value: 'DetailType' },
                                            Amount: { label: 'Amount', value: 'Amount' },
                                            Id: { label: 'Id', value: 'Id' },
                                            Description: { label: 'Description', value: 'Description' }
                                        }
                                    }
                                }
                            },
                            Adjustment: { type: 'boolean', title: 'Adjustment' },
                            Id: { type: 'string', title: 'Id' },
                            TxnTaxDetail: {
                                type: 'object',
                                title: 'TxnTaxDetail',
                                schema: {
                                    type: 'object',
                                    properties: {}
                                }
                            },
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
