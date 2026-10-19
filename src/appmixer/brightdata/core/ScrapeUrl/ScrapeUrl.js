'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { zone, url, dataFormat, httpMethod, country, body } = context.messages.in.content;

        if (!zone) {
            throw new context.CancelError('Zone is required!');
        }
        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const extra = {};

        // `html` is what the Web Unlocker returns anyway; only a conversion needs
        // to be requested explicitly.
        if (dataFormat && dataFormat !== 'html') {
            extra.data_format = dataFormat;
        }
        if (country) {
            extra.country = String(country).toLowerCase();
        }
        if (httpMethod) {
            extra.method = httpMethod;
        }
        if (body) {
            extra.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await lib.zoneRequest({ context, zone, url, extra });

        const content = typeof response.data === 'string'
            ? response.data
            : JSON.stringify(response.data);

        return context.sendJson({
            url,
            zone,
            statusCode: response.status,
            content
        }, 'out');
    }
};
