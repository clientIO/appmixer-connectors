'use strict';
const commons = require('../../sageone-commons');

/**
 * Component for fetching list of accounts
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v1/ledger_accounts';

        return commons.getItems({
            token: token,
            url: url,
            userAgent: userAgent,
            clientSigningSecret: clientSigningSecret,
            parameters: {
                $startIndex: 0,
                $itemsPerPage: 50
            }
        }).then(accounts => {
            return context.sendJson(accounts, 'ledgerAccounts');
        });
    }
};
