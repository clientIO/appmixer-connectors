'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const auth = require('./auth');

const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function safeEqual(a, b) {

    const bufferA = Buffer.from(String(a));
    const bufferB = Buffer.from(String(b));
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

// Webhooks are signed with a base64 HMAC-SHA256 of the raw request body, keyed
// with the app's client secret, in the X-Shopify-Hmac-Sha256 header.
function verifyWebhookHmac(rawBody, signature, clientSecret) {

    if (!clientSecret || !signature) {
        return false;
    }

    const expected = createHmac('sha256', clientSecret).update(rawBody).digest('base64');
    return safeEqual(expected, signature);
}

// Plugin routes cannot declare a required scope, so the admin scope of the
// authenticated user is checked by hand. Anything unexpected counts as no admin.
function isAdmin(req) {

    const scope = req.auth && req.auth.credentials && req.auth.credentials.scope;
    return Array.isArray(scope) && scope.includes('admin');
}

module.exports = function(context) {

    const models = {
        '/customers/data_request': require('./CustomerDataRequest')(context),
        '/customers/redact': require('./CustomerRedactRequest')(context),
        '/shop/redact': require('./ShopRedactRequest')(context)
    };

    /**
     * App URL of the Shopify app — Shopify sends the merchant here when the app is
     * installed from the App Store or from an install link:
     * https://api.YOUR_TENANT.appmixer.cloud/plugins/appmixer/shopify/install?shop=example.myshopify.com
     * The merchant is forwarded to the consent screen and lands on
     * `appStoreInstallRedirectUri` (connector configuration) afterwards.
     */
    context.http.router.register({
        method: 'GET',
        path: '/install',
        options: {
            auth: false,
            handler: (req, h) => {

                const { shop } = req.query;

                // `shop` ends up as the host of the redirect, so it must be a
                // genuine myshopify.com domain.
                if (!SHOP_DOMAIN_PATTERN.test(shop || '')) {
                    return h.response({ error: 'Invalid shop.' }).code(400);
                }
                if (!context.config.appStoreInstallRedirectUri) {
                    return h.response({ error: 'appStoreInstallRedirectUri is not configured.' }).code(500);
                }

                const params = new URLSearchParams({
                    'client_id': context.config.clientId,
                    'redirect_uri': context.config.appStoreInstallRedirectUri,
                    scope: auth.definition.scope.join(',')
                });

                return h.redirect(`https://${shop}/admin/oauth/authorize?${params}`);
            }
        }
    });

    // Mandatory compliance webhooks of a public Shopify app. Shopify expects a 401
    // for a request with an invalid signature and a 200 otherwise. The requests
    // are stored for the tenant to act on.
    Object.keys(models).forEach(path => {

        const Model = models[path];

        context.http.router.register({
            method: 'POST',
            path,
            options: {
                auth: false,
                // The signature covers the raw body, not a re-serialized one.
                payload: {
                    parse: false
                },
                handler: async (req, h) => {

                    const rawBody = Buffer.isBuffer(req.payload) ? req.payload : Buffer.from(req.payload || '');
                    const signature = req.headers['x-shopify-hmac-sha256'];
                    if (!verifyWebhookHmac(rawBody, signature, context.config.clientSecret)) {
                        return h.response({ error: 'Invalid HMAC.' }).code(401);
                    }

                    let request;
                    try {
                        request = JSON.parse(rawBody.toString('utf8'));
                    } catch (err) {
                        return h.response({ error: 'Invalid payload.' }).code(400);
                    }

                    await new Model().populate({ request, created: new Date() }).save();

                    return {};
                }
            }
        });

        context.http.router.register({
            method: 'GET',
            path,
            options: {
                // The stored requests hold personal data of the customers of
                // every connected store — for tenant admins only.
                handler: async (req, h) => {

                    if (!isAdmin(req)) {
                        return h.response({ error: 'Admin access required.' }).code(403);
                    }

                    return (await Model.find()) || [];
                }
            }
        });
    });
};

module.exports.verifyWebhookHmac = verifyWebhookHmac;
