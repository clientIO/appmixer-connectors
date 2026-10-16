'use strict';
const { sendArrayOutput, withCache, getOutputPortOptions } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'accounts';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['AccountID', 'Code', 'Name', 'Status', 'Type'],
    properties: {
        AccountID: { type: 'string', title: 'Account ID', example: '2a9b7c14-6d38-4e52-8f01-3b4c5d6e7f80' },
        Code: { type: 'string', title: 'Code', example: '200' },
        Name: { type: 'string', title: 'Name', example: 'Sales' },
        Status: { type: 'string', title: 'Status', example: 'ACTIVE' },
        Type: { type: 'string', title: 'Type', example: 'REVENUE' },
        TaxType: { type: 'string', title: 'TaxType', example: 'OUTPUT2' },
        Description: { type: 'string', title: 'Description', example: 'Income from any normal business activity' },
        Class: { type: 'string', title: 'Class', example: 'REVENUE' },
        SystemAccount: { type: 'string', title: 'SystemAccount', example: 'DEBTORS' },
        BankAccountType: { type: 'string', title: 'BankAccountType', example: 'BANK' },
        EnablePaymentsToAccount: { type: 'boolean', title: 'EnablePaymentsToAccount', example: false },
        ShowInExpenseClaims: { type: 'boolean', title: 'ShowInExpenseClaims', example: false },
        ReportingCode: { type: 'string', title: 'ReportingCode', example: 'REV' },
        ReportingCodeName: { type: 'string', title: 'ReportingCodeName', example: 'Revenue' },
        HasAttachments: { type: 'boolean', title: 'HasAttachments', example: false },
        UpdatedDateUTC: { type: 'string', title: 'UpdatedDateUTC', example: '/Date(1774000000000+0000)/' },
        AddToWatchlist: { type: 'boolean', title: 'AddToWatchlist', example: false }
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

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Accounts',
            outputPortName
        });
    }
};
