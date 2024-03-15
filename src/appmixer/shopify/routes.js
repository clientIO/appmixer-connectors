module.exports = function(context) {

    const CustomerDataRequest = require('./CustomerDataRequest')(context);
    const CustomerRedactRequest = require('./CustomerRedactRequest')(context);
    const ShopRedactRequest = require('./ShopRedactRequest')(context);

    context.http.router.register({
        method: 'POST',
        path: '/customers/data_request',
        options: {
            handler: (req) => {

                const { payload } = req;

                return new CustomerDataRequest().populate({
                    request: payload,
                    created: new Date(),
                }).save();
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/customers/redact',
        options: {
            handler: (req) => {

                const { payload } = req;

                return new CustomerRedactRequest().populate({
                    request: payload,
                    created: new Date(),
                }).save();
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/shop/redact',
        options: {
            handler: (req) => {

                const { payload } = req;

                return new ShopRedactRequest().populate({
                    request: payload,
                    created: new Date(),
                }).save();
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/customers/data_request',
        options: {
            handler: (request, h) => {
                return CustomerDataRequest.find() || [];
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/customers/redact',
        options: {
            handler: () => {
                return CustomerRedactRequest.find() || [];
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/shop/redact',
        options: {
            handler: () => {
                return ShopRedactRequest.find() || [];
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/',
        options: {
            handler: (request, h) => {
                return {
                    version: '1.0',
                    published: new Date().toISOString()
                };
            },
            auth: false
        }
    });
};
