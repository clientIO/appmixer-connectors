const crypto = require('crypto');

module.exports = (context, options) => {

    const AppEventTrigger = require('./AppEventTriggerModel')(context);


    // curl -XPOST \
    //     -H 'Content-Type: application/json' \
    //     -H "Authorization: Bearer ACCESS_TOKEN" \
    //     -d '{ "name": { "first": "David", "last": "Doe" } }' \
    // "https://APPMIXER_TENANT_API_URL/plugins/appmixer/utils/appevents/events/my-test"

    context.http.router.register({
        method: 'POST',
        path: '/events/{event}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async req => {

                const event = req.params.event;
                const data = req.payload;
                const query = req.query || {};
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();

                const triggersQuery = { event, userId };
                if (query.flowId) {
                    triggersQuery.flowId = query.flowId;
                }
                const triggers = await AppEventTrigger.find(triggersQuery);
                if (!triggers || !triggers.length) {
                    return { triggers: [] };
                }

                // Use enqueueOnly=true in query to enqueue message to Appmixer ASAP without waiting
                // for the entire receive() to finish.
                query.enqueueOnly = 'true';

                const errors = [];

                for (let trigger of triggers) {
                    // Generate a correlationId to be able to track the message and match it with a response.
                    const correlationId = crypto.randomUUID();
                    try {
                        await context.triggerComponent(
                            trigger.flowId,
                            trigger.componentId,
                            data,
                            { ...query, correlationId }, {
                                method: 'POST',
                                hostname: req.info.hostname,
                                headers: req.headers
                            }
                        );
                        // Add correlationId to the response.
                        trigger.correlationId = correlationId;
                    } catch (err) {
                        const error = {
                            message: 'AppEvents plugin error when triggering component ' + trigger.componentId + ' in flow ' + trigger.flowId,
                            code: 'TRIGGER_FAILURE',
                            trigger,
                            err
                        };
                        errors.push(error);
                        context.log('error', error.message);
                    }
                }

                return { triggers, errors };
            }
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/triggers',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async req => {

                const { event, componentId, flowId } = req.payload;
                const user = await context.http.auth.getUser(req);
                const userId = user.getId();

                return new AppEventTrigger().populate({
                    userId,
                    event,
                    componentId,
                    flowId,
                    createdAt: new Date()
                }).save();

            }
        }
    });

    context.http.router.register({
        method: 'DELETE',
        path: '/triggers/{componentId}',
        options: {
            auth: {
                strategies: ['jwt-strategy', 'public']
            },
            handler: async (req, h) => {
                await AppEventTrigger.deleteById(req.params.componentId);
                return h.response({});
            }
        }
    });
};
