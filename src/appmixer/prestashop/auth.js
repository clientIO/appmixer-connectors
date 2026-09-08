'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        tokenType: 'authentication-token',

        auth: {
            shopUrl: {
                type: 'text',
                name: 'Shop URL',
                tooltip: 'The base URL of your PrestaShop store, e.g. <b>https://www.myshop.com</b>. The Webservice API is exposed under <i>/api</i>.'
            },
            apiKey: {
                type: 'text',
                name: 'Webservice Key',
                tooltip: 'Enable the Webservice in your PrestaShop back office (Advanced Parameters -> Webservice) and generate a key with access to the required resources.'
            }
        },

        accountNameFromProfileInfo: 'name',

        // The PrestaShop Webservice does not expose a "me" profile endpoint, so the account
        // name is derived from the shop URL the user provides.
        requestProfileInfo: async (context) => {
            const shopUrl = (context.shopUrl || '').replace(/\/+$/, '');
            return { name: shopUrl };
        },

        validate: async (context) => {
            const shopUrl = (context.shopUrl || '').replace(/\/+$/, '');
            const credentials = Buffer.from(`${context.apiKey}:`).toString('base64');

            // Intentionally no output_format=JSON: PrestaShop 8 has a core bug in the JSON
            // serializer of the /api/ resource listing (apostrophe in a resource description
            // crashes WebserviceOutputJSON with a 500). The default XML listing works fine and
            // we only care about the 200 vs 401 distinction here.
            await context.httpRequest({
                method: 'GET',
                url: `${shopUrl}/api/`,
                headers: {
                    'Authorization': `Basic ${credentials}`
                }
            });

            return true;
        }
    }
};
