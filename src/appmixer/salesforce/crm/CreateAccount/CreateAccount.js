'use strict';
const commons = require('../lib');

/**
 * Build account.
 * @param {Object} account
 * @return {Object} accountObject
 */
function buildAccount(account) {

    let accountObject = {
        Name: account.name
    };

    if (account['parentId']) {
        accountObject['ParentId'] = account['parentId'];
    }

    if (account['website']) {
        accountObject['Website'] = account['website'];
    }

    if (account['phone']) {
        accountObject['Phone'] = account['phone'];
    }

    if (account['fax']) {
        accountObject['Fax'] = account['fax'];
    }

    if (account['industry']) {
        accountObject['Industry'] = account['industry'];
    }

    if (account['type']) {
        accountObject['Type'] = account['type'];
    }

    if (account['accountNumber']) {
        accountObject['AccountNumber'] = account['accountNumber'];
    }

    // != null (not truthiness) so an explicit 0 is stored, not dropped.
    if (account['numberOfEmployees'] != null && account['numberOfEmployees'] !== '') {
        accountObject['NumberOfEmployees'] = account['numberOfEmployees'];
    }

    if (account['annualRevenue'] != null && account['annualRevenue'] !== '') {
        accountObject['AnnualRevenue'] = account['annualRevenue'];
    }

    if (account['description']) {
        accountObject['Description'] = account['description'];
    }

    if (account['billingStreet']) {
        accountObject['BillingStreet'] = account['billingStreet'];
    }

    if (account['billingCity']) {
        accountObject['BillingCity'] = account['billingCity'];
    }

    if (account['billingState']) {
        accountObject['BillingState'] = account['billingState'];
    }

    if (account['billingZip']) {
        accountObject['BillingPostalCode'] = account['billingZip'];
    }

    if (account['billingCountry']) {
        accountObject['BillingCountry'] = account['billingCountry'];
    }

    return accountObject;
}

/**
 * Create new account in Salesforce.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const { name } = context.messages.account.content;
        if (!name) {
            throw new context.CancelError('Account Name is required!');
        }

        const client = commons.getSalesforceAPI(context);
        const accountObject = buildAccount(context.messages.account.content);

        return client.sobject('Account').create(accountObject)
            .then(result => {
                return client.sobject('Account').retrieve(result['id']);
            })
            .then(result => {
                return context.sendJson(result, 'newAccount');
            });
    }
};
