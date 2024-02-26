'use strict';
const commons = require('../../sageone-commons');
const Promise = require('bluebird');

/**
 * Process transactions to find newly added.
 * @param {Set} knownTransactions
 * @param {Array} currentTransactions
 * @param {Array} newTransactions
 * @param {Object} transaction
 */
function processTransactions(knownTransactions, currentTransactions, newTransactions, transaction) {

    if (knownTransactions && !knownTransactions.has(transaction['id'])) {
        newTransactions.push(transaction);
    }
    currentTransactions.push(transaction['id']);
}

/**
 * Component which triggers whenever new transaction is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v1/transactions';

        let res = await commons.sageoneAPI('GET', token, url, userAgent, clientSigningSecret);
        const data = JSON.parse(res);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        data.forEach(processTransactions.bind(null, known, current, diff));

        await Promise.map(diff, transaction => {
            return context.sendJson(transaction, 'newTransaction');
        });
        await context.saveState({ known: current });
    }
};
