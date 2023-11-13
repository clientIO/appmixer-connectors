'use strict';

const lib = require('./lib');

module.exports = async context => {

    context.http.router.register({
        method: 'POST',
        // {APPMIXER_API_URL}/plugins/appmixer/{SERVICE}/events
        path: '/events',
        options: {
            auth: false,
            handler: async req => {

                context.log('info', 'plugin-route-hit', {
                    payload: req.payload,
                    headers: req.headers
                });

                const expCondition = lib.jsonata('payload.event = "endpoint.url_validation"');
                const condition = await expCondition.evaluate(req);
                if (condition) {
                    const crypto = require('crypto');
                    const alg = 'sha256';
                    const key = context.config['webhookSecretToken'];
                    const expChallenge = lib.jsonata('payload.payload.plainToken');
                    const challenge = await expChallenge.evaluate(req);
                    const responseToken = crypto.createHmac(alg, key).update(challenge).digest(
                        'hex');
                    const expResponse = lib.jsonata(
                        '{ "encryptedToken": responseToken, "plainToken": challenge }');
                    const response = await expResponse.evaluate({
                        responseToken,
                        challenge
                    });
                    return response;
                }

                const allRegisteredComponents = {};

                const patterns = ["payload.event & ':' & payload.payload.account_id"];
                for (const pattern of patterns) {
                    const expTopic = lib.jsonata(pattern);
                    const topic = await expTopic.evaluate(req);
                    const registeredComponents = await context.service.stateGet(topic);
                    if (registeredComponents) {
                        registeredComponents.forEach(c => allRegisteredComponents[c.componentId] =
                            c);
                    }
                }

                context.log('info', 'plugin-route-log', {
                    registeredComponentsCount: Object.keys(allRegisteredComponents).length
                });

                if (Object.keys(allRegisteredComponents).length === 0) {
                    return {};
                }

                // We cannot wait for the results since most webhooks expect 200 response in a certain
                // period, otherwise retries will be sent.
                Promise.allSettled(Object.values(allRegisteredComponents).map(component => {
                    return context.triggerComponent(
                        component.flowId,
                        component.componentId,
                        req.payload,
                        req.query, {
                            method: 'POST',
                            hostname: req.info.hostname,
                            headers: req.headers
                        }
                    );
                })).then(results => {
                    results.forEach(result => {
                        if (result.status === 'rejected') {
                            context.log(
                                'Plugin error when triggering one of the components.',
                                result.reason);
                        }
                    });
                }).catch(err => {
                    context.log('Plugin error', err.message, err);
                });
                return {};
            }
        }
    });

};
