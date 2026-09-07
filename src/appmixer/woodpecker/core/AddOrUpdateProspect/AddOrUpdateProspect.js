'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { email, firstName, lastName, company, title } = context.messages.in.content;

        if (!email) {
            throw new context.CancelError('Email is required!');
        }

        const prospect = { email };
        if (firstName) {
            prospect['first_name'] = firstName;
        }
        if (lastName) {
            prospect['last_name'] = lastName;
        }
        if (company) {
            prospect.company = company;
        }
        if (title) {
            prospect.title = title;
        }

        // The upsert endpoint is /v1/add_prospects_list (POST /v1/prospects does not exist).
        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.API_BASE_URL}/v1/add_prospects_list`,
            headers: lib.getHeaders(context),
            data: { update: 'true', prospects: [prospect] }
        });

        const saved = (response.data.prospects && response.data.prospects[0]) || {};
        return context.sendJson({ ...prospect, ...saved }, 'out');
    }
};
