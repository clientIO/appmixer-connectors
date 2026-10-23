'use strict';

const crypto = require('crypto');

const SECRET_HASH_PATTERN = /^[a-f0-9]{64}$/;

const hashSecret = secret => crypto.createHash('sha256').update(`${secret}`).digest('hex');

const secretHashMatches = (expected, actual) => {

    if (typeof expected !== 'string' || !SECRET_HASH_PATTERN.test(expected)) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

module.exports = async context => {

    // Triggers register with the instance of their connection and the SHA-256 hash of the
    // connection's webhook secret. Listeners without them could be triggered by anyone who
    // knows the event name, so they are rejected.
    context.onListenerAdded(async listener => {

        const { instance, secretHash } = listener.params || {};
        if (!instance) {
            throw new Error('Missing instance listener param.');
        }
        if (typeof secretHash !== 'string' || !SECRET_HASH_PATTERN.test(secretHash)) {
            throw new Error('Missing or invalid secretHash listener param.');
        }
        if (!listener.eventName?.startsWith(`${instance}.`)) {
            throw new Error('Listener event name does not belong to the connection\'s instance.');
        }

        listener.params = { instance: `${instance}`, secretHash };
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async (req, h) => {

                const { data = {}, type } = req.payload || {};

                if (!type) {
                    context.log('error', 'Missing \'type\' property.');
                    return h.response({ error: 'Missing \'type\' property.' }).code(400);
                }

                const secret = req.headers['x-appmixer-secret'];
                if (!secret) {
                    context.log('error', 'servicenow-plugin-route-webhook-missing-secret', { type });
                    return h.response({ error: 'Missing X-Appmixer-Secret header.' }).code(401);
                }

                // The event name is `<instance>.<table>.<operation>`. Only listeners whose
                // connection has the same instance and webhook secret are triggered, so one
                // user's instance can't deliver records to another user's flows.
                const instance = `${type}`.split('.')[0];
                const secretHash = hashSecret(secret);
                await context.triggerListeners({
                    eventName: type,
                    payload: data,
                    filter: listener => listener.params?.instance === instance
                        && secretHashMatches(listener.params?.secretHash, secretHash)
                });

                return {};
            }
        }
    });
};
