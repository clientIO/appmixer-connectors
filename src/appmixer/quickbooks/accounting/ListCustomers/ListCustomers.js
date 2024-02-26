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
        let query = 'select * from customer';

        // Remove extra spaces and line breaks.
        const searchTerm = term?.replace(/\s+/g, ' ').trim();

        if (!searchTerm) {
            // no term, just list all items.
            query = 'select * from customer';
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

        const options = {
            path: `v3/company/${context.profileInfo.companyId}/query?minorversion=${minorVersion}&query=${encodeURIComponent(query)}`,
            method: 'GET'
        };

        await context.log({ step: 'Making request', options });
        const response = await makeRequest({ context, options });

        return sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: response.data?.QueryResponse?.Customer || []
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'domain', value: 'domain' },
                { label: 'FamilyName', value: 'FamilyName' },
                { label: 'DisplayName', value: 'DisplayName' },
                {
                    label: 'DefaultTaxCodeRef', value: 'DefaultTaxCodeRef',
                    schema: {
                        type: 'object',
                        properties: {
                            value: { label: 'value', value: 'value' }
                        }
                    }
                },
                {
                    label: 'PrimaryEmailAddr', value: 'PrimaryEmailAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            Address: { label: 'Address', value: 'Address' }
                        }
                    }
                },
                { label: 'PreferredDeliveryMethod', value: 'PreferredDeliveryMethod' },
                { label: 'GivenName', value: 'GivenName' },
                { label: 'FullyQualifiedName', value: 'FullyQualifiedName' },
                { label: 'BillWithParent', value: 'BillWithParent' },
                { label: 'Job', value: 'Job' },
                { label: 'BalanceWithJobs', value: 'BalanceWithJobs' },
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
                {
                    label: 'BillAddr', value: 'BillAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            City: { label: 'City', value: 'City' },
                            Line1: { label: 'Line1', value: 'Line1' },
                            PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                            Lat: { label: 'Lat', value: 'Lat' },
                            Long: { label: 'Long', value: 'Long' },
                            CountrySubDivisionCode: { label: 'CountrySubDivisionCode', value: 'CountrySubDivisionCode' },
                            Id: { label: 'Id', value: 'Id' }
                        }
                    }
                },
                { label: 'MiddleName', value: 'MiddleName' },
                { label: 'Notes', value: 'Notes' },
                { label: 'Taxable', value: 'Taxable' },
                { label: 'Balance', value: 'Balance' },
                { label: 'SyncToken', value: 'SyncToken' },
                { label: 'CompanyName', value: 'CompanyName' },
                {
                    label: 'ShipAddr', value: 'ShipAddr',
                    schema: {
                        type: 'object',
                        properties: {
                            City: { label: 'City', value: 'City' },
                            Line1: { label: 'Line1', value: 'Line1' },
                            PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                            Lat: { label: 'Lat', value: 'Lat' },
                            Long: { label: 'Long', value: 'Long' },
                            CountrySubDivisionCode: { label: 'CountrySubDivisionCode', value: 'CountrySubDivisionCode' },
                            Id: { label: 'Id', value: 'Id' }
                        }
                    }
                },
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
                            domain: { type: 'string', title: 'domain' },
                            FamilyName: { type: 'string', title: 'FamilyName' },
                            DisplayName: { type: 'string', title: 'DisplayName' },
                            DefaultTaxCodeRef: {
                                type: 'object', title: 'DefaultTaxCodeRef',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        value: { label: 'value', value: 'value' }
                                    }
                                }
                            },
                            PrimaryEmailAddr: {
                                type: 'object', title: 'PrimaryEmailAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        Address: { label: 'Address', value: 'Address' }
                                    }
                                }
                            },
                            PreferredDeliveryMethod: { type: 'string', title: 'PreferredDeliveryMethod' },
                            GivenName: { type: 'string', title: 'GivenName' },
                            FullyQualifiedName: { type: 'string', title: 'FullyQualifiedName' },
                            BillWithParent: { type: 'boolean', title: 'BillWithParent' },
                            Job: { type: 'boolean', title: 'Job' },
                            BalanceWithJobs: { type: 'number', title: 'BalanceWithJobs' },
                            PrimaryPhone: {
                                type: 'object', title: 'PrimaryPhone',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        FreeFormNumber: { label: 'FreeFormNumber', value: 'FreeFormNumber' }
                                    }
                                }
                            },
                            Active: { type: 'boolean', title: 'Active' },
                            MetaData: {
                                type: 'object', title: 'MetaData',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        CreateTime: { label: 'CreateTime', value: 'CreateTime' },
                                        LastUpdatedTime: { label: 'LastUpdatedTime', value: 'LastUpdatedTime' }
                                    }
                                }
                            },
                            BillAddr: {
                                type: 'object', title: 'BillAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        City: { label: 'City', value: 'City' },
                                        Line1: { label: 'Line1', value: 'Line1' },
                                        PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                                        Lat: { label: 'Lat', value: 'Lat' },
                                        Long: { label: 'Long', value: 'Long' },
                                        CountrySubDivisionCode: { label: 'CountrySubDivisionCode', value: 'CountrySubDivisionCode' },
                                        Id: { label: 'Id', value: 'Id' }
                                    }
                                }
                            },
                            MiddleName: { type: 'string', title: 'MiddleName' },
                            Notes: { type: 'string', title: 'Notes' },
                            Taxable: { type: 'boolean', title: 'Taxable' },
                            Balance: { type: 'number', title: 'Balance' },
                            SyncToken: { type: 'string', title: 'SyncToken' },
                            CompanyName: { type: 'string', title: 'CompanyName' },
                            ShipAddr: {
                                type: 'object', title: 'ShipAddr',
                                schema: {
                                    type: 'object',
                                    properties: {
                                        City: { label: 'City', value: 'City' },
                                        Line1: { label: 'Line1', value: 'Line1' },
                                        PostalCode: { label: 'PostalCode', value: 'PostalCode' },
                                        Lat: { label: 'Lat', value: 'Lat' },
                                        Long: { label: 'Long', value: 'Long' },
                                        CountrySubDivisionCode: { label: 'CountrySubDivisionCode', value: 'CountrySubDivisionCode' },
                                        Id: { label: 'Id', value: 'Id' }
                                    }
                                }
                            },
                            PrintOnCheckName: { type: 'string', title: 'PrintOnCheckName' },
                            sparse: { type: 'boolean', title: 'sparse' },
                            Id: { type: 'string', title: 'Id' }
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
