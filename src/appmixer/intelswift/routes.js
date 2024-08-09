'use strict';

module.exports = async context => {

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async req => {

                const { data = {}, name, action } = req.payload || {};

                let error = '';

                if (!name) {
                    error = 'Missing event name';
                    context.log('error', error, req.payload);
                    return { error: error };
                }

                const { tenantId } = data;

                if (!tenantId) {
                    error = 'Missing tenantId property';
                    context.log('error', error, req.payload);
                    return { error: error };
                }

                if (!tenantId) {
                    context.log('error', 'Missing tenantId property.', req.payload);
                    return {};
                }

                await context.triggerListeners({
                    eventName: tenantId,
                    payload: { ...data, action },
                    filter: listener => {
                        return  listener.params.eventName === name;
                    }
                });

                return {};
            }
        }
    });
};
