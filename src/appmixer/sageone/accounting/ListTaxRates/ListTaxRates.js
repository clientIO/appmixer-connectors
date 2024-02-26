'use strict';
const commons = require('../../sageone-commons');

/**
 * Component for fetching list of tax rates.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v1/tax_rates';

        return commons.sageoneAPI('GET', token, url, userAgent, clientSigningSecret)
            .then(taxRates => {
                const data = JSON.parse(taxRates);
                return context.sendJson(data['$resources'], 'taxRates');
            });
    }
};
