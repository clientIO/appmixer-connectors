'use strict';
const { sendArrayOutput, getOutputPortOptions } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'out';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['ManualJournalID', 'Narration', 'Date', 'Status'],
    properties: {
        ManualJournalID: {
            type: 'string',
            title: 'Manual Journal ID',
            example: '9f3c1b2a-5d6e-4f70-8a91-2b3c4d5e6f70'
        },
        Narration: { type: 'string', title: 'Narration', example: 'Accrued consulting fees' },
        Date: { type: 'string', title: 'Date', example: '/Date(1774051200000+0000)/' },
        DateString: { type: 'string', title: 'Date String', example: '2026-03-18T00:00:00' },
        Status: { type: 'string', title: 'Status', example: 'POSTED' },
        LineAmountTypes: { type: 'string', title: 'Line Amount Types', example: 'NoTax' },
        JournalLines: {
            type: 'array',
            title: 'Journal Lines',
            example: [
                {
                    LineAmount: 1200.0,
                    AccountCode: '400',
                    AccountID: '2a9b7c14-6d38-4e52-8f01-3b4c5d6e7f80',
                    Description: 'Accrued consulting fees',
                    TaxType: 'NONE',
                    TaxAmount: 0.0,
                    IsBlank: false
                }
            ],
            items: {
                type: 'object',
                properties: {
                    LineAmount: { type: 'number', title: 'LineAmount' },
                    AccountCode: { type: 'string', title: 'AccountCode' },
                    AccountID: { type: 'string', title: 'AccountID' },
                    Description: { type: 'string', title: 'Description' },
                    TaxType: { type: 'string', title: 'TaxType' },
                    TaxAmount: { type: 'number', title: 'TaxAmount' },
                    IsBlank: { type: 'boolean', title: 'IsBlank' }
                }
            }
        },
        Url: {
            type: 'string',
            title: 'Url',
            example: 'https://go.xero.com/Journal/View.aspx?invoiceID=9f3c1b2a-5d6e-4f70-8a91-2b3c4d5e6f70'
        },
        ShowOnCashBasisReports: { type: 'boolean', title: 'Show On Cash Basis Reports', example: true },
        HasAttachments: { type: 'boolean', title: 'Has Attachments', example: false },
        UpdatedDateUTC: { type: 'string', title: 'Updated Date UTC', example: '/Date(1774059000000+0000)/' },
        UpdatedDateUTCString: {
            type: 'string',
            title: 'Updated Date UTC String',
            example: '2026-03-18T09:24:31.123'
        }
    }
};

/**
 * Parse Xero's /Date(timestamp+offset)/ format into ISO string.
 */
function xeroDateToISO(xeroDate) {
    if (!xeroDate) return null;
    const match = xeroDate.match(/\/Date\((\d+)([+-]\d{4})?\)\//);
    if (!match) return null;
    return new Date(parseInt(match[1], 10)).toISOString().replace(/\.\d{3}Z$/, '');
}

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, Status, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        if (!tenantId) {
            throw new context.CancelError('Tenant ID is required.');
        }

        const params = {};
        if (Status) {
            params.where = `Status=="${Status}"`;
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/ManualJournals', {
            dataKey: 'ManualJournals',
            params
        });

        if (!records || records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        // Xero ManualJournals API doesn't return DateString, so we parse it.
        for (const record of records) {
            if (record.Date) {
                record.DateString = xeroDateToISO(record.Date);
            }
            if (record.UpdatedDateUTC) {
                record.UpdatedDateUTCString = xeroDateToISO(record.UpdatedDateUTC);
            }
        }

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Manual Journals',
            outputPortName
        });
    }
};
