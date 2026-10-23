'use strict';

const lib = require('../../lib');

// One payment account as returned by GET /my/accounts (Accounts API v3).
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id'],
    properties: {
        id: { type: 'string', title: 'Account ID', example: 'D2C8C1DCC51A3738538A40A4863CA288E0225E52' },
        identification: {
            type: 'object',
            title: 'Identification',
            properties: {
                iban: { type: 'string', title: 'Identification.IBAN', example: 'CZ6508000000192000145399' },
                other: { type: 'string', title: 'Identification.Other', example: '19-2000145399/0800' }
            }
        },
        currency: { type: 'string', title: 'Currency', example: 'CZK' },
        nameI18N: { type: 'string', title: 'Account Name', example: 'Osobní účet ČS' },
        productI18N: { type: 'string', title: 'Product Name', example: 'Moje zlaté konto' },
        servicer: {
            type: 'object',
            title: 'Servicer',
            properties: {
                bic: { type: 'string', title: 'Servicer.BIC', example: 'GIBACZPX' },
                bankCode: { type: 'string', title: 'Servicer.Bank Code', example: '0800' },
                countryCode: { type: 'string', title: 'Servicer.Country Code', example: 'CZ' }
            }
        },
        ownersNames: {
            type: 'array',
            title: 'Owners Names',
            items: { type: 'string' },
            example: ['Jan Novák']
        },
        relationship: {
            type: 'object',
            title: 'Relationship',
            properties: {
                isOwner: { type: 'boolean', title: 'Relationship.Is Owner', example: true }
            }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Accounts', value: 'result' });
        }

        if (context.properties.isSource) {
            // Inspector dropdown: cache the call and never surface an error popup — the
            // Account ID field is a typeahead, so the user can still type the ID.
            try {
                const accounts = await lib.withCache(context, { path: '/my/accounts' }, () => {
                    return lib.fetchAllPages(context, '/my/accounts', 'accounts');
                });
                return context.sendJson({ result: accounts }, 'out');
            } catch (err) {
                return context.sendJson({ result: [] }, 'out');
            }
        }

        const accounts = await lib.fetchAllPages(context, '/my/accounts', 'accounts');
        return lib.sendArrayOutput({ context, outputType, records: accounts });
    },

    toSelectOptions(msg) {
        return (msg.result || []).map(account => {
            const name = [account.nameI18N, account.productI18N && `(${account.productI18N})`].filter(Boolean).join(' ');
            const number = account.identification && (account.identification.other || account.identification.iban);
            return {
                label: [name || account.id, number].filter(Boolean).join(' – '),
                value: account.id
            };
        });
    }
};
