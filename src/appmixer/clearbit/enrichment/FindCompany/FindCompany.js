'use strict';
const commons = require('../../clearbit-commons');

/**
 * Build options data.
 * @param {Object} attributes
 * @return {Object} optionsObject
 */
function buildOptions(attributes) {

    let optionsObject = {
        'domain': attributes['domain']
    };

    if (attributes['companyName']) {
        optionsObject['company_name'] = attributes['companyName'];
    }

    if (attributes['linkedIn']) {
        optionsObject['linkedin'] = attributes['linkedIn'];
    }

    if (attributes['twitter']) {
        optionsObject['twitter'] = attributes['twitter'];
    }

    if (attributes['facebook']) {
        optionsObject['facebook'] = attributes['facebook'];
    }

    return optionsObject;
}

/**
 * Component for finding a company in clearbit.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            let res = context.messages.webhook.content.data.body;
            res.site.emailAddresses = res.site.emailAddresses.join(', ');
            res.site.phoneNumbers = res.site.phoneNumbers.join(', ');
            res.tags = res.tags.join(', ');
            res.tech = res.tech.join(', ');
            await context.sendJson(res, 'company');
            await context.response();
            return;
        }

        let { apiKey } = context.auth;
        let attributes = context.messages.attributes.content;
        let client = commons.getClearbitAPI({ key: apiKey });
        let options = buildOptions(attributes);
        options['webhook_url'] = context.getWebhookUrl();

        // do not send result into output port here. We use webhooks to
        // get response from clearbit
        return client.Company.find(options)
            .catch(client.Company.QueuedError, () => {
                // when result is not ready immediately clearbit returns this error
                // that's ok, we'll get result via webhook
                return;
            });
    }
};

