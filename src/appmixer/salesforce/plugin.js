const Promise = require('bluebird');
module.exports = function(context) {

    context.http.router.register({
        method: 'GET',
        path: '/test',
        options: {
            handler: (request, h) => {
                return { test: 'test' };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/events/{organizationId}',
        options: {
            auth: false,
            handler: async req => {

                const { organizationId } = req.params;

                if (!organizationId) {
                    context.log('error', 'Missing organization Id parameter.', req.params);
                    return { error: 'Missing organization Id parameter.' };
                }

                const registeredComponents = await context.service.stateGet(organizationId);
                if (!registeredComponents) {
                    return { info: 'No registered components found' };
                }


                // we cannot wait for the results, 200 response has to be sent to slack within 3
                // seconds, otherwise they're going to send retries
                const concurrency = 100;
                const errors = [];
                await Promise.map(registeredComponents, async registered => {

                    try {
                        await context.triggerComponent(
                            registered.flowId,
                            registered.componentId,
                            req.payload,
                            {},
                            {}
                        );
                    } catch (e) {

                        const id = `${registered.flowId}__${registered.componentId}`;
                        errors.push({
                            flowId: registered.flowId,
                            componentId: registered.componentId,
                            error: {
                                id,
                                message: e.message
                            }
                        });

                        console.log('error', id, e.message, e);
                    }

                }, { concurrency });

                return {
                    success: errors.length === 0,
                    errors,
                    info: registeredComponents.map(item => `${item.flowId} - ${item.componentId}`)
                };

            }
        }
    });

};
