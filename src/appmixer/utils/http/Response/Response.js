'use strict';

/**
 * This component is used to return HTTP response.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { body, statusCode, headers = {} } = context.messages.in.content;

        if (typeof headers === 'string') {
            try {
                headers = JSON.parse(headers);
            } catch (e) {
                await context.log({ stage: 'error parsing json', body });
                throw new context.CancelError('Unable to parse headers', e);
            }
        }

        if (headers?.['Content-type'] === 'application/json' && typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                await context.log({ stage: 'error parsing json', body });
                throw new context.CancelError('Unable to parse body', e);
            }
        }

        return context.response(body, statusCode, headers);
    }
};
