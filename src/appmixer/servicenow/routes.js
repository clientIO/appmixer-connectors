module.exports = async context => {

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async req => {

                const { data = {}, type } = req.payload || {};

                if (!type) {
                    context.log('error', 'Missing \'type\' property.', { payload: req.payload });
                    throw new Error('Missing \'type\' property.');
                }

                await context.triggerListeners({
                    eventName: type,
                    payload: data
                });

                return {};
            }
        }
    });
};
