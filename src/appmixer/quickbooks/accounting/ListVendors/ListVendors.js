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
        let query = 'select * from vendor';

        // Remove extra spaces and line breaks.
        const searchTerm = term?.replace(/\s+/g, ' ').trim();

        if (!searchTerm) {
            // no term, just list all items.
            query = 'select * from vendor';
        } else if (searchType === 'nameEquals') {
            query += ` where DisplayName='${searchTerm}'`;
        } else if (searchType === 'nameContains') {
            query += ` where DisplayName like '%${searchTerm}%'`;
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
            records: response.data?.QueryResponse?.Vendor || []
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'domain', value: 'domain' },
                {
                    label: 'PrimaryEmailAddr', value: 'PrimaryEmailAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            Address: { label: 'Address', value: 'Address' }
                        }
                    }
                },
                { label: 'DisplayName', value: 'DisplayName' },
                {
                    label: 'CurrencyRef', value: 'CurrencyRef',
                    schema: {
                        type: 'object',
                        properties: {
                            name: { label: 'name', value: 'name' }, value: { label: 'value', value: 'value' }
                        }
                    }
                },
                { label: 'GivenName', value: 'GivenName' },
                { label: 'Title', value: 'Title' },
                {
                    label: 'PrimaryPhone', value: 'PrimaryPhone',
                    schema: {
                        type: 'object',
                        properties: {
                            FreeFormNumber: { label: 'FreeFormNumber', value: 'FreeFormNumber' }
                        }
                    }
                },
                { label: 'Active', value: 'Active' },
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
                { label: 'Vendor1099', value: 'Vendor1099' },
                {
                    label: 'BillAddr', value: 'BillAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            City: { label: 'City', value: 'City' },
                            Country: { label: 'Country', value: 'Country' },
                            Line3: { label: 'Line3', value: 'Line3' },
                            Line2: { label: 'Line2', value: 'Line2' },
                            Line1: { label: 'Line1', value: 'Line1' },
                            PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                            CountrySubDivisionCode: {
                                label: 'CountrySubDivisionCode',
                                value: 'CountrySubDivisionCode'
                            },
                            Id: { label: 'Id', value: 'Id' }
                        }
                    }
                },
                {
                    label: 'Mobile', value: 'Mobile',
                    schema: {
                        type: 'object',
                        properties: {
                            FreeFormNumber: { label: 'FreeFormNumber', value: 'FreeFormNumber' }
                        }
                    }
                },
                {
                    label: 'WebAddr', value: 'WebAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            URI: { label: 'URI', value: 'URI' }
                        }
                    }
                },
                { label: 'Balance', value: 'Balance' },
                { label: 'SyncToken', value: 'SyncToken' },
                { label: 'Suffix', value: 'Suffix' },
                { label: 'CompanyName', value: 'CompanyName' },
                { label: 'FamilyName', value: 'FamilyName' },
                { label: 'TaxIdentifier', value: 'TaxIdentifier' },
                { label: 'AcctNum', value: 'AcctNum' },
                { label: 'PrintOnCheckName', value: 'PrintOnCheckName' },
                { label: 'sparse', value: 'sparse' },
                { label: 'Id', value: 'Id' }
            ], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{
                label: 'Items', value: 'items',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            Id: { type: 'string', title: 'Id' },
                            domain: { type: 'string', title: 'domain' },
                            PrimaryEmailAddr: {
                                type: 'object',
                                title: 'PrimaryEmailAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        Address: { label: 'Address', value: 'Address' }
                                    }
                                }
                            },
                            DisplayName: { type: 'string', title: 'DisplayName' },
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
                            GivenName: { type: 'string', title: 'GivenName' },
                            Title: { type: 'string', title: 'Title' },
                            PrimaryPhone: {
                                type: 'object',
                                title: 'PrimaryPhone',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        FreeFormNumber: { label: 'FreeFormNumber', value: 'FreeFormNumber' }
                                    }
                                }
                            },
                            Active: {
                                type: 'boolean',
                                title: 'Active'
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
                            },
                            Vendor1099: { type: 'boolean', title: 'Vendor1099' },
                            BillAddr: {
                                type: 'object',
                                title: 'BillAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        City: { label: 'City', value: 'City' },
                                        Country: { label: 'Country', value: 'Country' },
                                        Line3: { label: 'Line3', value: 'Line3' },
                                        Line2: { label: 'Line2', value: 'Line2' },
                                        Line1: { label: 'Line1', value: 'Line1' },
                                        PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                                        CountrySubDivisionCode: {
                                            label: 'CountrySubDivisionCode',
                                            value: 'CountrySubDivisionCode'
                                        },
                                        Id: { label: 'Id', value: 'Id' }
                                    }
                                }
                            },
                            Mobile: {
                                type: 'object',
                                title: 'Mobile',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        FreeFormNumber: { label: 'FreeFormNumber', value: 'FreeFormNumber' }
                                    }
                                }
                            },
                            WebAddr: {
                                type: 'object',
                                title: 'WebAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        URI: { label: 'URI', value: 'URI' }
                                    }
                                }
                            },
                            Balance: { type: 'number', title: 'Balance' },
                            SyncToken: { type: 'string', title: 'SyncToken' },
                            Suffix: { type: 'string', title: 'Suffix' },
                            CompanyName: { type: 'string', title: 'CompanyName' },
                            FamilyName: { type: 'string', title: 'FamilyName' },
                            TaxIdentifier: { type: 'string', title: 'TaxIdentifier' },
                            AcctNum: { type: 'string', title: 'AcctNum' },
                            PrintOnCheckName: { type: 'string', title: 'PrintOnCheckName' },
                            sparse: { type: 'boolean', title: 'sparse' }
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
