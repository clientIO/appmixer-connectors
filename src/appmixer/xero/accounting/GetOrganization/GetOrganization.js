'use strict';
const XeroClient = require('../../XeroClient');
const { getOutputPortOptions } = require('../../commons');

const outputPortName = 'out';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['Name', 'OrganisationID', 'BaseCurrency', 'CountryCode'],
    properties: {
        OrganisationID: {
            type: 'string',
            title: 'Organisation ID',
            example: 'f4d93dc2-0a17-4b6e-9c58-3e1d7a0b2c94'
        },
        Name: { type: 'string', title: 'Name', example: 'Appmixer test 2026' },
        LegalName: { type: 'string', title: 'Legal Name', example: 'Appmixer Test Ltd' },
        PaysTax: { type: 'boolean', title: 'Pays Tax', example: true },
        Version: { type: 'string', title: 'Version', example: 'NZ' },
        OrganisationType: { type: 'string', title: 'Organisation Type', example: 'COMPANY' },
        BaseCurrency: { type: 'string', title: 'Base Currency', example: 'NZD' },
        CountryCode: { type: 'string', title: 'Country Code', example: 'NZ' },
        IsDemoCompany: { type: 'boolean', title: 'Is Demo Company', example: false },
        OrganisationStatus: { type: 'string', title: 'Organisation Status', example: 'ACTIVE' },
        RegistrationNumber: { type: 'string', title: 'Registration Number', example: '1234567' },
        EmployerIdentificationNumber: {
            type: 'string',
            title: 'Employer Identification Number',
            example: '12-3456789'
        },
        TaxNumber: { type: 'string', title: 'Tax Number', example: '123-456-789' },
        FinancialYearEndDay: { type: 'number', title: 'Financial Year End Day', example: 31 },
        FinancialYearEndMonth: { type: 'number', title: 'Financial Year End Month', example: 3 },
        SalesTaxBasis: { type: 'string', title: 'Sales Tax Basis', example: 'PAYMENTS' },
        SalesTaxPeriod: { type: 'string', title: 'Sales Tax Period', example: 'TWOMONTHS' },
        DefaultSalesTax: { type: 'string', title: 'Default Sales Tax', example: 'Tax Exclusive' },
        PeriodLockDate: { type: 'string', title: 'Period Lock Date', example: '/Date(1767139200000+0000)/' },
        EndOfYearLockDate: { type: 'string', title: 'End Of Year Lock Date', example: '/Date(1743379200000+0000)/' },
        CreatedDateUTC: { type: 'string', title: 'Created Date UTC', example: '/Date(1705219964147+0000)/' },
        Timezone: { type: 'string', title: 'Timezone', example: 'NEWZEALANDSTANDARDTIME' },
        OrganisationEntityType: { type: 'string', title: 'Organisation Entity Type', example: 'COMPANY' },
        ShortCode: { type: 'string', title: 'Short Code', example: '!aBcDe' },
        LineOfBusiness: { type: 'string', title: 'Line Of Business', example: 'Design services' },
        Addresses: {
            type: 'array',
            title: 'Addresses',
            example: [
                {
                    AddressType: 'STREET',
                    AddressLine1: '12 Bridge Street',
                    City: 'Wellington',
                    PostalCode: '6011',
                    AttentionTo: 'Accounts'
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
                { PhoneType: 'OFFICE', PhoneNumber: '555 0143', PhoneAreaCode: '04', PhoneCountryCode: '64' }
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
        ExternalLinks: {
            type: 'array',
            title: 'External Links',
            example: [{ LinkType: 'Website', Url: 'https://www.acmedesign.example.com' }],
            items: {
                type: 'object',
                properties: {
                    LinkType: { type: 'string', title: 'LinkType' },
                    Url: { type: 'string', title: 'Url' }
                }
            }
        },
        PaymentTerms: {
            type: 'object',
            title: 'Payment Terms',
            example: { Sales: { Day: 20, Type: 'OFFOLLOWINGMONTH' } }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const { tenantId } = context.messages.in.content;

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/Organisation', { dataKey: 'Organisations' });

        // Get component: a single organisation object is sent as-is, fields at the top level.
        return context.sendJson(records[0], outputPortName);
    },

    getOutputPortOptions(context) {

        // A Get component emits one organisation object, so the picker always lists its fields.
        return getOutputPortOptions(context, 'item', ITEM_SCHEMA.properties, { outputPortName });
    }
};
