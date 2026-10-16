'use strict';

const lib = require('../../lib');

// One transaction as returned by GET /my/accounts/{id}/transactions (Accounts API v3).
const ITEM_SCHEMA = {
    type: 'object',
    required: ['amount', 'creditDebitIndicator'],
    properties: {
        entryReference: { type: 'string', title: 'Entry Reference', example: '20260915-0800-1234567890' },
        amount: {
            type: 'object',
            title: 'Amount',
            properties: {
                value: { type: 'number', title: 'Amount.Value', example: 1250.5 },
                currency: { type: 'string', title: 'Amount.Currency', example: 'CZK' }
            }
        },
        creditDebitIndicator: { type: 'string', title: 'Credit/Debit Indicator', example: 'DBIT' },
        status: { type: 'string', title: 'Status', example: 'BOOK' },
        bookingDate: {
            type: 'object',
            title: 'Booking Date',
            properties: {
                date: { type: 'string', title: 'Booking Date.Date', example: '2026-09-15' }
            }
        },
        valueDate: {
            type: 'object',
            title: 'Value Date',
            properties: {
                date: { type: 'string', title: 'Value Date.Date', example: '2026-09-15' }
            }
        },
        bankTransactionCode: {
            type: 'object',
            title: 'Bank Transaction Code',
            properties: {
                proprietary: {
                    type: 'object',
                    title: 'Bank Transaction Code.Proprietary',
                    properties: {
                        code: { type: 'number', title: 'Bank Transaction Code.Proprietary.Code', example: 10000101000 },
                        issuer: { type: 'string', title: 'Bank Transaction Code.Proprietary.Issuer', example: 'CBA' }
                    }
                }
            }
        },
        entryDetails: {
            type: 'object',
            title: 'Entry Details',
            properties: {
                transactionDetails: {
                    type: 'object',
                    title: 'Entry Details.Transaction Details',
                    properties: {
                        references: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.References',
                            properties: {
                                accountServicerReference: { type: 'string', title: 'Entry Details.Transaction Details.References.Account Servicer Reference', example: '000000-1234567890' },
                                endToEndIdentification: { type: 'string', title: 'Entry Details.Transaction Details.References.End To End Identification', example: 'VS:2026001' },
                                chequeNumber: { type: 'string', title: 'Entry Details.Transaction Details.References.Cheque Number', example: '4570' }
                            }
                        },
                        amountDetails: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.Amount Details',
                            properties: {
                                instructedAmount: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Amount Details.Instructed Amount',
                                    properties: {
                                        amount: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Amount Details.Instructed Amount.Amount',
                                            properties: {
                                                value: { type: 'number', title: 'Entry Details.Transaction Details.Amount Details.Instructed Amount.Amount.Value', example: 1250.5 },
                                                currency: { type: 'string', title: 'Entry Details.Transaction Details.Amount Details.Instructed Amount.Amount.Currency', example: 'CZK' }
                                            }
                                        }
                                    }
                                },
                                counterValueAmount: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount',
                                    properties: {
                                        amount: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Amount',
                                            properties: {
                                                value: { type: 'number', title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Amount.Value', example: 1250.5 },
                                                currency: { type: 'string', title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Amount.Currency', example: 'CZK' }
                                            }
                                        },
                                        currencyExchange: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Currency Exchange',
                                            properties: {
                                                sourceCurrency: { type: 'string', title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Currency Exchange.Source Currency', example: 'EUR' },
                                                targetCurrency: { type: 'string', title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Currency Exchange.Target Currency', example: 'CZK' },
                                                exchangeRate: { type: 'number', title: 'Entry Details.Transaction Details.Amount Details.Counter Value Amount.Currency Exchange.Exchange Rate', example: 24.35 }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        charges: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.Charges',
                            properties: {
                                bearer: { type: 'string', title: 'Entry Details.Transaction Details.Charges.Bearer', example: 'SHAR' }
                            }
                        },
                        relatedParties: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.Related Parties',
                            properties: {
                                debtor: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Parties.Debtor',
                                    properties: {
                                        name: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Debtor.Name', example: 'Jan Novák' }
                                    }
                                },
                                debtorAccount: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Parties.Debtor Account',
                                    properties: {
                                        identification: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Related Parties.Debtor Account.Identification',
                                            properties: {
                                                iban: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Debtor Account.Identification.IBAN', example: 'CZ6508000000192000145399' },
                                                other: {
                                                    type: 'object',
                                                    title: 'Entry Details.Transaction Details.Related Parties.Debtor Account.Identification.Other',
                                                    properties: {
                                                        identification: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Debtor Account.Identification.Other.Identification', example: '19-2000145399/0800' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                creditor: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Parties.Creditor',
                                    properties: {
                                        name: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Creditor.Name', example: 'Acme s.r.o.' }
                                    }
                                },
                                creditorAccount: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Parties.Creditor Account',
                                    properties: {
                                        identification: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Related Parties.Creditor Account.Identification',
                                            properties: {
                                                iban: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Creditor Account.Identification.IBAN', example: 'CZ5503000000000123456789' },
                                                other: {
                                                    type: 'object',
                                                    title: 'Entry Details.Transaction Details.Related Parties.Creditor Account.Identification.Other',
                                                    properties: {
                                                        identification: { type: 'string', title: 'Entry Details.Transaction Details.Related Parties.Creditor Account.Identification.Other.Identification', example: '123456789/0300' }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        relatedAgents: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.Related Agents',
                            properties: {
                                debtorAgent: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Agents.Debtor Agent',
                                    properties: {
                                        financialInstitutionIdentification: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Related Agents.Debtor Agent.Financial Institution Identification',
                                            properties: {
                                                bic: { type: 'string', title: 'Entry Details.Transaction Details.Related Agents.Debtor Agent.Financial Institution Identification.BIC', example: 'GIBACZPX' }
                                            }
                                        }
                                    }
                                },
                                creditorAgent: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Related Agents.Creditor Agent',
                                    properties: {
                                        financialInstitutionIdentification: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Related Agents.Creditor Agent.Financial Institution Identification',
                                            properties: {
                                                bic: { type: 'string', title: 'Entry Details.Transaction Details.Related Agents.Creditor Agent.Financial Institution Identification.BIC', example: 'CEKOCZPP' }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        remittanceInformation: {
                            type: 'object',
                            title: 'Entry Details.Transaction Details.Remittance Information',
                            properties: {
                                unstructured: { type: 'string', title: 'Entry Details.Transaction Details.Remittance Information.Unstructured', example: 'Invoice 2026001' },
                                structured: {
                                    type: 'object',
                                    title: 'Entry Details.Transaction Details.Remittance Information.Structured',
                                    properties: {
                                        creditorReferenceInformation: {
                                            type: 'object',
                                            title: 'Entry Details.Transaction Details.Remittance Information.Structured.Creditor Reference Information',
                                            properties: {
                                                reference: {
                                                    type: 'array',
                                                    title: 'Entry Details.Transaction Details.Remittance Information.Structured.Creditor Reference Information.Reference',
                                                    items: { type: 'string' },
                                                    example: ['VS:2026001', 'KS:0308']
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        additionalTransactionInformation: { type: 'string', title: 'Entry Details.Transaction Details.Additional Transaction Information', example: 'Platba kartou' },
                        additionalRemittanceInformation: { type: 'string', title: 'Entry Details.Transaction Details.Additional Remittance Information', example: 'Monthly subscription' },
                        additionalTransactionDescription: { type: 'string', title: 'Entry Details.Transaction Details.Additional Transaction Description', example: 'Odchozí úhrada' }
                    }
                }
            }
        }
    }
};

// The API takes plain dates (YYYY-MM-DD). A value that already starts with a date is
// cut to it, so a date-time picked in the designer is not shifted by a UTC conversion.
function toApiDate(context, value, label) {
    if (!value) {
        return undefined;
    }
    const text = String(value).trim();
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) {
        return match[0];
    }
    const date = new Date(text);
    if (isNaN(date.getTime())) {
        throw new context.CancelError(`${label} "${value}" is not a valid date. Use the YYYY-MM-DD format.`);
    }
    return date.toISOString().slice(0, 10);
}

function bookingDateOf(transaction) {
    return (transaction.bookingDate && transaction.bookingDate.date) || '';
}

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { accountId, fromDate, toDate, creditDebitIndicator, order = 'desc', outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Transactions', value: 'result' });
        }

        if (!accountId) {
            throw new context.CancelError('Account ID is required!');
        }

        const params = {};
        const from = toApiDate(context, fromDate, 'From Date');
        const to = toApiDate(context, toDate, 'To Date');
        if (from) {
            params.fromDate = from;
        }
        if (to) {
            params.toDate = to;
        }
        if (from && to && from > to) {
            throw new context.CancelError(`From Date (${from}) must not be after To Date (${to}).`);
        }

        const path = '/my/accounts/' + encodeURIComponent(accountId) + '/transactions';
        let transactions = await lib.fetchAllPages(context, path, 'transactions', params);

        if (creditDebitIndicator) {
            transactions = transactions.filter(trx => trx.creditDebitIndicator === creditDebitIndicator);
        }

        // Sort by booking date on our side: the order of a multi-page result must not
        // depend on how the API happens to order its pages.
        const direction = order === 'asc' ? 1 : -1;
        transactions.sort((a, b) => direction * bookingDateOf(a).localeCompare(bookingDateOf(b)));

        if (transactions.length === 0) {
            return context.sendJson({ accountId, fromDate: from, toDate: to }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: transactions });
    }
};
