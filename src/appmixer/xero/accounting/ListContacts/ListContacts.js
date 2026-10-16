'use strict';
const { sendArrayOutput, withCache, getOutputPortOptions } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'contacts';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['ContactID', 'Name', 'ContactStatus'],
    properties: {
        ContactID: { type: 'string', title: 'Contact ID', example: 'a1b2c3d4-e5f6-4071-8293-a4b5c6d7e8f9' },
        ContactNumber: { type: 'string', title: 'ContactNumber', example: 'CUST-0042' },
        ContactStatus: { type: 'string', title: 'ContactStatus', example: 'ACTIVE' },
        Name: { type: 'string', title: 'Name', example: 'Acme Design Ltd' },
        FirstName: { type: 'string', title: 'FirstName', example: 'Jane' },
        LastName: { type: 'string', title: 'LastName', example: 'Nguyen' },
        EmailAddress: { type: 'string', title: 'EmailAddress', example: 'jane.nguyen@example.com' },
        Addresses: {
            type: 'array',
            title: 'Addresses',
            example: [
                {
                    AddressType: 'STREET',
                    AddressLine1: '12 Bridge Street',
                    City: 'Wellington',
                    PostalCode: '6011',
                    AttentionTo: 'Accounts Payable'
                }
            ],
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
        },
        Phones: {
            type: 'array',
            title: 'Phones',
            example: [
                { PhoneType: 'DEFAULT', PhoneNumber: '555 0143', PhoneAreaCode: '04', PhoneCountryCode: '64' }
            ],
            items: {
                type: 'object',
                properties: {
                    PhoneType: { type: 'string', title: 'PhoneType' },
                    PhoneNumber: { type: 'string', title: 'PhoneNumber' },
                    PhoneAreaCode: { type: 'string', title: 'PhoneAreaCode' },
                    PhoneCountryCode: { type: 'string', title: 'PhoneCountryCode' }
                }
            }
        },
        UpdatedDateUTC: { type: 'string', title: 'UpdatedDateUTC', example: '/Date(1774000000000+0000)/' },
        // Xero does not document the ContactGroups item shape, so only the array type is declared.
        ContactGroups: {
            type: 'array',
            title: 'ContactGroups',
            example: [
                {
                    ContactGroupID: 'b7d1f0c4-4c2e-4a9b-9f1d-6c8a2e5b7d31',
                    Name: 'Preferred suppliers',
                    Status: 'ACTIVE'
                }
            ]
        },
        IsSupplier: { type: 'boolean', title: 'IsSupplier', example: false },
        IsCustomer: { type: 'boolean', title: 'IsCustomer', example: true },
        Website: { type: 'string', title: 'Website', example: 'https://www.acmedesign.example.com' },
        ContactPersons: {
            type: 'array',
            title: 'ContactPersons',
            example: [
                {
                    FirstName: 'Jane',
                    LastName: 'Nguyen',
                    EmailAddress: 'jane.nguyen@example.com',
                    IncludeInEmails: true
                }
            ],
            items: {
                type: 'object',
                properties: {
                    FirstName: { type: 'string', title: 'FirstName' },
                    LastName: { type: 'string', title: 'LastName' },
                    EmailAddress: { type: 'string', title: 'EmailAddress' },
                    IncludeInEmails: { type: 'boolean', title: 'IncludeInEmails' }
                }
            }
        },
        HasAttachments: { type: 'boolean', title: 'HasAttachments', example: false },
        HasValidationErrors: { type: 'boolean', title: 'HasValidationErrors', example: false }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }

        // Cache the assembled (post-pagination) contacts array so the burst of inspector source calls
        // does not trip Xero's rate limits. See commons.withCache for details.
        const records = await withCache(
            context,
            { tenantId, url: '/api.xro/2.0/Contacts', params },
            () => new XeroClient(context, tenantId).requestPaginated('GET', '/api.xro/2.0/Contacts', { params })
        );

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Contacts',
            outputPortName
        });
    }
};
