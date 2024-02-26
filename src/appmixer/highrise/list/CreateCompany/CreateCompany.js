'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Build company data.
 * @param {Object} company
 * @param {string} visibleTo
 * @return {Object} companyObject
 */
function buildCompany(company, visibleTo) {

    let companyObject = {
        'name': company['name'],
        'visible_to': visibleTo,
        'contact_data': {}
    };

    companyObject['background'] = company['background'] ? company['background'] : undefined;

    if (company['email']) {
        companyObject['contact_data']['email_addresses'] = {
            'email_address': {
                'address': company['email'],
                'location': company['emailLocation']
            }
        };
    }
    if (company['phone']) {
        companyObject['contact_data']['phone_numbers'] = {
            'phone_number': {
                'number': company['phone'],
                'location': company['phoneLocation']
            }
        };
    }
    if (company['imAddress']) {
        companyObject['contact_data']['instant_messengers'] = {
            'instant_messenger': {
                'address': company['imAddress'],
                'protocol': company['imProtocol'],
                'location': company['imLocation']
            }
        };
    }
    if (company['twitter']) {
        companyObject['contact_data']['twitter_accounts'] = {
            'twitter_account': {
                'username': company['twitter']
            }
        };
    }
    if (company['web']) {
        companyObject['contact_data']['web_addresses'] = {
            'web_address': {
                'url': company['web'],
                'location': company['webLocation']
            }
        };
    }

    return companyObject;
}

/**
 * Tag company record.
 * @param client
 * @param {string} companyId
 * @param {string} tag
 * @return Promise
 */
function tagCompany(client, companyId, tag) {

    // Tag and Tags classes are available from github master branch
    // https://github.com/florianholzapfel/node-highrise-api/tree/master
    let createTag = Promise.promisify(client.tag.create, { context: client.tag });

    return createTag({
        'subject_type': 'companies',
        'subject_id': companyId,
        'name': tag
    });
}

/**
 * Component for company creation or update on highrise.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId, visibleTo } = context.properties;
        let companyInfo = context.messages.company.content;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let findCompanies = Promise.promisify(client.companies.find, { context: client.companies });

        return findCompanies({
            'name': companyInfo['name']
        }).then(foundCompanies => {
            let companyRequest = buildCompany(companyInfo, visibleTo);
            // update already created company
            if (foundCompanies.length) {
                let promises = [];

                foundCompanies.forEach(foundCompany => {

                    let updateCompany = Promise.promisify(foundCompany.update, { context: foundCompany });
                    delete companyRequest['contact_data'];
                    Object.assign(foundCompany, companyRequest);
                    promises.push(updateCompany().then(() => foundCompany));
                });
                return Promise.all(promises);
            } else {
                // create new company
                let createCompany = Promise.promisify(client.company.create, { context: client.company });
                return createCompany(companyRequest);
            }
        }).then(companies => {

            // process tags
            companies = Array.isArray(companies) ? companies : [companies];
            if (companyInfo['tag']) {
                let promises = [];
                companies.forEach(createdCompany => {

                    let createdCompanyId = createdCompany['id'] || createdCompany['req']['path'].match(/\d+/)[0];
                    promises.push(
                        tagCompany(client, createdCompanyId, companyInfo['tag'])
                            .then(() => createdCompany)); // return the company to promise for later pickup
                });
                return Promise.all(promises);
            } else {
                return Promise.resolve(companies);
            }
        }).then(companies => {
            return Promise.map(companies, company => {
                // get rid of client helper functions
                delete company.client;
                return context.sendJson(company, 'newCompany');
            });
        });
    }
};
