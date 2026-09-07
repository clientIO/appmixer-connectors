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
 * Fetch the transactions list. Shared by tick() and test().
 * @param {Object} context
 * @returns {Promise<Array>}
 */
async function fetchTransactions(context) {

    const token = context.auth.accessToken;
    const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
    const userAgent = context.auth.profileInfo.userAgent;
    const url = 'https://api.sageone.com/accounts/v1/transactions';

    const res = await commons.sageoneAPI('GET', token, url, userAgent, clientSigningSecret);
    return JSON.parse(res);
}

/**
 * Component which triggers whenever new transaction is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const data = await fetchTransactions(context);

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        data.forEach(processTransactions.bind(null, known, current, diff));

        await Promise.map(diff, transaction => {
            return context.sendJson(transaction, 'newTransaction');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        // Fetch the transactions list without the state baseline so a real
        // example is emitted in the same shape and port as tick().
        const data = await fetchTransactions(context);
        if (!Array.isArray(data) || !data.length) {
            throw new Error('No transactions available to use as test data.');
        }
        return context.sendJson(data[0], 'newTransaction');
    }
};
