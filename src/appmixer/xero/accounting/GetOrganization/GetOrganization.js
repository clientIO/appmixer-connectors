'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'out';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/Organisation', { dataKey: 'Organisations' });

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records: records[0]
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { value: 'Name', label: 'Name' },
                    { value: 'LegalName', label: 'Legal Name' },
                    { value: 'PaysTax', label: 'Pays Tax' },
                    { value: 'Version', label: 'Version' },
                    { value: 'OrganisationType', label: 'Organisation Type' },
                    { value: 'BaseCurrency', label: 'Base Currency' },
                    { value: 'CountryCode', label: 'Country Code' },
                    { value: 'IsDemoCompany', label: 'Is Demo Company' },
                    { value: 'OrganisationStatus', label: 'Organisation Status' },
                    { value: 'RegistrationNumber', label: 'Registration Number' },
                    { value: 'EmployerIdentificationNumber', label: 'Employer Identification Number' },
                    { value: 'TaxNumber', label: 'Tax Number' },
                    { value: 'FinancialYearEndDay', label: 'Financial Year End Day' },
                    { value: 'FinancialYearEndMonth', label: 'Financial Year End Month' },
                    { value: 'SalesTaxBasis', label: 'Sales Tax Basis' },
                    { value: 'SalesTaxPeriod', label: 'Sales Tax Period' },
                    { value: 'DefaultSalesTax', label: 'Default Sales Tax' },
                    { value: 'PeriodLockDate', label: 'Period Lock Date' },
                    { value: 'EndOfYearLockDate', label: 'End Of Year Lock Date' },
                    { value: 'CreatedDateUTC', label: 'Created Date UTC' },
                    { value: 'Timezone', label: 'Timezone' },
                    { value: 'OrganisationEntityType', label: 'Organisation Entity Type' },
                    { value: 'ShortCode', label: 'Short Code' },
                    { value: 'LineOfBusiness', label: 'Line Of Business' },
                    {
                        value: 'Addresses', label: 'Addresses', schema: {
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
                    {
                        label: 'ExternalLinks', value: 'External Links', schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    LinkType: { type: 'string', title: 'LinkType' },
                                    Url: { type: 'string', title: 'Url' }
                                }
                            }
                        }
                    },
                    { label: 'PaymentTerms', value: 'Payment Terms' }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            // So far this is only called for a single item. No ListOrganizations component exists.
            throw context.createError('Not implemented yet');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], outputPortName);
        }
    }
};
