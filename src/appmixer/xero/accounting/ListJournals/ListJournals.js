'use strict';
const { sendArrayOutput, getOutputPortOptions } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'journals';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['JournalID', 'JournalDate', 'JournalNumber'],
    properties: {
        JournalID: { type: 'string', title: 'Journal ID', example: '3c8d5e21-7a94-4b60-8f13-9d2e4a6b8c05' },
        JournalDate: { type: 'string', title: 'Journal Date', example: '/Date(1774051200000+0000)/' },
        JournalNumber: { type: 'number', title: 'Journal Number', example: 1284 },
        CreatedDateUTC: { type: 'string', title: 'Created Date UTC', example: '/Date(1774059000000+0000)/' },
        Reference: { type: 'string', title: 'Reference', example: 'INV-2026-0035' },
        SourceID: { type: 'string', title: 'Source ID', example: 'd4e5f6a7-b8c9-0123-defa-345678901234' },
        SourceType: { type: 'string', title: 'Source Type', example: 'ACCREC' },
        JournalLines: {
            type: 'array',
            title: 'Journal Lines',
            example: [
                {
                    JournalLineID: '6b2c9d47-1e53-4f08-9a26-7c3d5e8f0a19',
                    AccountID: '2a9b7c14-6d38-4e52-8f01-3b4c5d6e7f80',
                    AccountCode: '200',
                    AccountType: 'REVENUE',
                    AccountName: 'Sales',
                    Description: 'Design consultancy',
                    NetAmount: 3200.0,
                    GrossAmount: 3680.0,
                    TaxAmount: 480.0,
                    TaxType: 'OUTPUT2',
                    TaxName: '15% GST on Income',
                    TrackingCategories: []
                }
            ],
            items: {
                type: 'object',
                properties: {
                    JournalLineID: { type: 'string', title: 'Journal Line ID' },
                    AccountID: { type: 'string', title: 'Account ID' },
                    AccountCode: { type: 'string', title: 'Account Code' },
                    AccountType: { type: 'string', title: 'Account Type' },
                    AccountName: { type: 'string', title: 'Account Name' },
                    Description: { type: 'string', title: 'Description' },
                    NetAmount: { type: 'number', title: 'Net Amount' },
                    GrossAmount: { type: 'number', title: 'Gross Amount' },
                    TaxAmount: { type: 'number', title: 'Tax Amount' },
                    TaxType: { type: 'string', title: 'Tax Type' },
                    TaxName: { type: 'string', title: 'Tax Name' },
                    TrackingCategories: { type: 'array', title: 'Tracking Categories' }
                }
            }
        }
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

        const xc = new XeroClient(context, tenantId);
        // The Journals endpoint does not support page-based pagination: it returns up to 100
        // journals per call and the next batch is requested via `offset` (the last JournalNumber).
        const pageSize = 100;
        const countLimit = 10000;
        let records = [];
        let offset = 0;
        let batch;
        do {
            const response = await xc.request('GET', '/api.xro/2.0/Journals', { params: { ...params, offset } });
            batch = (response && response.Journals) || [];
            records = records.concat(batch);
            if (batch.length) {
                offset = batch[batch.length - 1].JournalNumber;
            }
        } while (batch.length === pageSize && records.length < countLimit);

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Journals',
            outputPortName
        });
    }
};
