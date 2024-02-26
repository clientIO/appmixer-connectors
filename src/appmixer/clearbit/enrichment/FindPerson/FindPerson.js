'use strict';
const commons = require('../../clearbit-commons');
const _ = require('lodash');

/**
 * @param {Object} res
 */
let processPerson = function(res) {

    if (res.company) {
        res.company.domainAliases = res.company.domainAliases ? res.company.domainAliases.join(',') : '';
        res.company.tags = res.company.tags ? res.company.tags.join(',') : '';
        res.company.tech = res.company.tech ? res.company.tech.join(',') : '';

        if (res.company.site) {
            res.company.site.emailAddresses = res.company.site.emailAddresses ?
                res.company.site.emailAddresses.join(',') : '';
            res.company.site.phoneNumbers = res.company.site.phoneNumbers ?
                res.company.site.phoneNumbers.join(',') : '';
        }
    }
    return res;
};

/**
 * Component for finding a person in clearbit.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            let data = context.messages.webhook.content.data;
            // Convert arrays to strings with comma separated items. This is because we don't
            // support arrays in handlebars variables.
            await context.sendJson(processPerson(data.body), 'person');
            await context.response();
            return;
        }

        let { apiKey } = context.auth;
        let attributes = context.messages.attributes.content;
        let client = commons.getClearbitAPI({ key: apiKey });
        let options = Object.assign({}, _.mapKeys(attributes, (value, key) => {
            return _.snakeCase(key);
        }));
        options['webhook_url'] = context.getWebhookUrl();

        // do not send result into output port here. We use webhooks to
        // get response from clearbit
        return client.Enrichment.find(options)
            .catch(client.Enrichment.QueuedError, () => {
                // when result is not ready immediately clearbit returns this error
                // that's ok, we'll get result via webhook
                return;
            });
    }
};

