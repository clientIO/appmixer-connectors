'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { contactId, language, withPointsAllocations, withTierExpiration } = context.messages.in.content;

        if (!contactId) {
            throw new context.CancelError('Contact External ID is required!');
        }

        const params = {};
        if (withPointsAllocations) {
            params.withPointsAllocations = true;
        }
        if (withTierExpiration) {
            params.withTierExpiration = true;
        }

        // The contact is identified by a header, not by a path segment or query param.
        const headers = { 'x-contact-id': contactId.toString() };
        if (language) {
            headers['x-language'] = language.toString();
        }

        const { status, data } = await lib.loyaltyRequest(context, { url: '/contact', params, headers });

        // 404 means this contact has no loyalty record — a normal answer, not a failure.
        if (status === 404 || !data) {
            return context.sendJson({}, 'notFound');
        }

        return context.sendJson(data, 'out');
    }
};
