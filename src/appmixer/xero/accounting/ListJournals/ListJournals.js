'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'journals';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/Journals', { params });

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
                    { value: 'JournalID', label: 'Journal ID' },
                    { value: 'JournalDate', label: 'Journal Date' },
                    { value: 'JournalNumber', label: 'Journal Number' },
                    { value: 'CreatedDateUTC', label: 'Created Date UTC' },
                    { value: 'Reference', label: 'Reference' },
                    { value: 'SourceID', label: 'Source ID' },
                    { value: 'SourceType', label: 'Source Type' },
                    { value: 'JournalLines', label: 'Journal Lines', schema: {
                        type: 'array',
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
                    } }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Journals',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    JournalID: { type: 'string', title: 'Journal ID' },
                                    JournalDate: { type: 'string', title: 'Journal Date' },
                                    JournalNumber: { type: 'string', title: 'Journal Number' },
                                    CreatedDateUTC: { type: 'string', title: 'Created Date UTC' },
                                    Reference: { type: 'string', title: 'Reference' },
                                    SourceID: { type: 'string', title: 'Source ID' },
                                    SourceType: { type: 'string', title: 'Source Type' },
                                    JournalLines: { type: 'array', title: 'Journal Lines', schema: {
                                        type: 'array',
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
                                    } }
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
