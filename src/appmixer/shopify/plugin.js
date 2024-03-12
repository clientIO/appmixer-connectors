const path = require('path');

module.exports = function(context) {

    context.http.router.register({
        method: 'POST',
        path: '/customers/data_request',
        options: {
            handler: (request, h) => {
                return {}
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/customers/redact',
        options: {
            handler: (request, h) => {
                return {}
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/shop/redact',
        options: {
            handler: (request, h) => {
                return {}
            },
            auth: false
        }
    });
};
