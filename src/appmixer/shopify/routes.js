const crypto = require('crypto');
const auth = require('./auth');

module.exports = function(context) {

    const CustomerDataRequest = require('./CustomerDataRequest')(context);
    const CustomerRedactRequest = require('./CustomerRedactRequest')(context);
    const ShopRedactRequest = require('./ShopRedactRequest')(context);

    /**
     * Shopify install link, Shopify calls this link to install the app:
     * https://api.qa.appmixer.com/plugins/appmixer/shopify/install?shop=appmixer.myshopify.com
     * Set the base url (https://api.qa.appmixer.com/plugins/appmixer/shopify) in the Shopify app settings.
     */
    context.http.router.register({
        method: 'GET',
        path: '/install',
        options: {
            handler: (req, h) => {

                const { shop } = req.query;
                const clientId = encodeURIComponent(context.config.clientId);
                const redirectUrl = encodeURIComponent(context.config.appStoreInstallRedirectUri);
                const scopes = encodeURIComponent(auth.definition.scope.join(','));

                const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUrl}&scope=${scopes}`;

                return h.redirect(authUrl);
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/customers/data_request',
        options: {
            handler: (req) => {

                verifyHmac(req, context.config.clientSecret);

                const { payload } = req;

                return new CustomerDataRequest().populate({
                    request: payload,
                    created: new Date()
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

                verifyHmac(req, context.config.clientSecret);

                const { payload } = req;

                return new CustomerRedactRequest().populate({
                    request: payload,
                    created: new Date()
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

                verifyHmac(req, context.config.clientSecret);

                const { payload } = req;

                return new ShopRedactRequest().populate({
                    request: payload,
                    created: new Date()
                }).save();
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/customers/data_request',
        options: {
            handler: () => {
                return CustomerDataRequest.find() || [];
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/customers/redact',
        options: {
            handler: () => {
                return CustomerRedactRequest.find() || [];
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/shop/redact',
        options: {
            handler: () => {
                return ShopRedactRequest.find() || [];
            }
        }
    });

    context.http.router.register({
        method: 'GET',
        path: '/',
        options: {
            handler: () => {
                return {
                    version: '1.0',
                    published: new Date().toISOString()
                };
            },
            auth: false
        }
    });

    const getSignature = function(data, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(data)
            .digest('base64');

    };

    /**
     * verify HMAC token from Shopify
     * https://shopify.dev/docs/apps/webhooks/configuration/https#step-5-verify-the-webhook
     * @param req
     * @param secret
     */
    const verifyHmac = function(req, secret) {

        const expected = req.headers['x-shopify-hmac-sha256'];
        const current = getSignature(JSON.stringify(req.payload), secret);

        if (current !== expected) {
            throw context.http.HttpError.unauthorized('Invalid HMAC. ' + current + ' ' + expected);
        }
    };
};

