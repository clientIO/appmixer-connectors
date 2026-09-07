'use strict';
const { sendArrayOutput, withCache } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'accounts';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required!');
        }

        // Cache the assembled accounts array so repeated inspector source calls reuse one fetch.
        const records = await withCache(
            context,
            { tenantId, url: '/api.xro/2.0/Accounts', params },
            () => new XeroClient(context, tenantId).requestPaginated('GET', '/api.xro/2.0/Accounts', { params })
        );

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
                    { label: 'Account ID', value: 'AccountID' },
                    { label: 'Code', value: 'Code' },
                    { label: 'Name', value: 'Name' },
                    { label: 'Status', value: 'Status' },
                    { label: 'Type', value: 'Type' },
                    { label: 'TaxType', value: 'TaxType' },
                    { label: 'Description', value: 'Description' },
                    { label: 'Class', value: 'Class' },
                    { label: 'SystemAccount', value: 'SystemAccount' },
                    { label: 'BankAccountType', value: 'BankAccountType' },
                    { label: 'EnablePaymentsToAccount', value: 'EnablePaymentsToAccount' },
                    { label: 'ShowInExpenseClaims', value: 'ShowInExpenseClaims' },
                    { label: 'ReportingCode', value: 'ReportingCode' },
                    { label: 'ReportingCodeName', value: 'ReportingCodeName' },
                    { label: 'HasAttachments', value: 'HasAttachments' },
                    { label: 'UpdatedDateUTC', value: 'UpdatedDateUTC' },
                    { label: 'AddToWatchlist', value: 'AddToWatchlist' }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Tracking Categories',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    AccountID: { type: 'string', title: 'Account ID' },
                                    Code: { type: 'string', title: 'Code' },
                                    Name: { type: 'string', title: 'Name' },
                                    Status: { type: 'string', title: 'Status' },
                                    Type: { type: 'string', title: 'Type' },
                                    TaxType: { type: 'string', title: 'TaxType' },
                                    Description: { type: 'string', title: 'Description' },
                                    Class: { type: 'string', title: 'Class' },
                                    SystemAccount: { type: 'string', title: 'SystemAccount' },
                                    EnablePaymentsToAccount: { type: 'boolean', title: 'EnablePaymentsToAccount' },
                                    ShowInExpenseClaims: { type: 'boolean', title: 'ShowInExpenseClaims' },
                                    BankAccountType: { type: 'string', title: 'BankAccountType' },
                                    ReportingCode: { type: 'string', title: 'ReportingCode' },
                                    ReportingCodeName: { type: 'string', title: 'ReportingCodeName' },
                                    HasAttachments: { type: 'boolean', title: 'HasAttachments' },
                                    UpdatedDateUTC: { type: 'string', title: 'UpdatedDateUTC' },
                                    AddToWatchlist: { type: 'boolean', title: 'AddToWatchlist' }
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
