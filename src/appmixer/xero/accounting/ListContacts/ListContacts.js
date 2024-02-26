'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'contacts';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/Contacts', { params });

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'Contact ID', value: 'ContactID' },
                    { label: 'ContactNumber', value: 'ContactNumber' },
                    { label: 'ContactStatus', value: 'ContactStatus' },
                    { label: 'Name', value: 'Name' },
                    { label: 'FirstName', value: 'FirstName' },
                    { label: 'LastName', value: 'LastName' },
                    { label: 'EmailAddress', value: 'EmailAddress' },
                    {
                        label: 'Addresses', value: 'Addresses', schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    AddressType: { type: 'string', title: 'AddressType' },
                                    AddressLine1: { type: 'string', title: 'AddressLine1' },
                                    City: { type: 'string', title: 'City' },
                                    PostalCode: { type: 'string', title: 'PostalCode' },
                                    AttentionTo: { type: 'string', title: 'AttentionTo' }
                                }
                            }
                        }
                    },
                    {
                        label: 'Phones', value: 'Phones', schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    PhoneType: { type: 'string', title: 'PhoneType' },
                                    PhoneNumber: { type: 'string', title: 'PhoneNumber' },
                                    PhoneAreaCode: { type: 'string', title: 'PhoneAreaCode' },
                                    PhoneCountryCode: { type: 'string', title: 'PhoneCountryCode' }
                                }
                            }
                        }
                    },
                    { label: 'UpdatedDateUTC', value: 'UpdatedDateUTC' },
                    // schema not known for ContactGroups
                    { label: 'ContactGroups', value: 'ContactGroups', schema: { type: 'array' } },
                    { label: 'IsSupplier', value: 'IsSupplier' },
                    { label: 'IsCustomer', value: 'IsCustomer' },
                    { label: 'Website', value: 'Website' },
                    {
                        label: 'ContactPersons', value: 'ContactPersons', schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    FirstName: { type: 'string', title: 'FirstName' },
                                    LastName: { type: 'string', title: 'LastName' },
                                    EmailAddress: { type: 'string', title: 'EmailAddress' },
                                    IncludeInEmails: { type: 'boolean', title: 'IncludeInEmails' }
                                }
                            }
                        }
                    },
                    { label: 'HasAttachments', value: 'HasAttachments' },
                    { label: 'HasValidationErrors', value: 'HasValidationErrors' }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Contacts',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    ContactID: { type: 'string', title: 'ContactID' },
                                    ContactNumber: { type: 'string', title: 'ContactNumber' },
                                    ContactStatus: { type: 'string', title: 'ContactStatus' },
                                    Name: { type: 'string', title: 'Name' },
                                    FirstName: { type: 'string', title: 'FirstName' },
                                    LastName: { type: 'string', title: 'LastName' },
                                    EmailAddress: { type: 'string', title: 'EmailAddress' },
                                    Addresses: {
                                        title: 'Addresses',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    AddressType: { type: 'string', title: 'AddressType' },
                                                    AddressLine1: { type: 'string', title: 'AddressLine1' },
                                                    City: { type: 'string', title: 'City' },
                                                    PostalCode: { type: 'string', title: 'PostalCode' },
                                                    AttentionTo: { type: 'string', title: 'AttentionTo' }
                                                }
                                            }
                                        }
                                    },
                                    Phones: {
                                        title: 'Phones',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    PhoneType: { type: 'string', title: 'PhoneType' },
                                                    PhoneNumber: { type: 'string', title: 'PhoneNumber' },
                                                    PhoneAreaCode: { type: 'string', title: 'PhoneAreaCode' },
                                                    PhoneCountryCode: { type: 'string', title: 'PhoneCountryCode' }
                                                }
                                            }
                                        }
                                    },
                                    UpdatedDateUTC: { type: 'string', title: 'UpdatedDateUTC' },
                                    // schema not known for ContactGroups
                                    ContactGroups: { type: 'string', title: 'ContactGroups' },
                                    IsSupplier: { type: 'boolean', title: 'IsSupplier' },
                                    IsCustomer: { type: 'boolean', title: 'IsCustomer' },
                                    Website: { type: 'string', title: 'Website' },
                                    ContactPersons: {
                                        title: 'ContactPersons',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    FirstName: { type: 'string', title: 'FirstName' },
                                                    LastName: { type: 'string', title: 'LastName' },
                                                    EmailAddress: { type: 'string', title: 'EmailAddress' },
                                                    IncludeInEmails: { type: 'boolean', title: 'IncludeInEmails' }
                                                }
                                            }
                                        }
                                    },
                                    HasAttachments: { type: 'boolean', title: 'HasAttachments' },
                                    HasValidationErrors: { type: 'boolean', title: 'HasValidationErrors' }
                                }
                            }
                        }
                    }
                ],
                outputPortName
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], outputPortName);
        }
    }
};
