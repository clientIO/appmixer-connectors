'use strict';

module.exports = {

    type: 'pwd',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            subdomain: {
                type: 'text',
                name: 'Subdomain',
                tooltip: 'Your Zapoj subdomain. For example, if your Zapoj URL is https://mycompany.zapoj.com, then the subdomain is mycompany.'
            },
            email: {
                type: 'text',
                name: 'Email'
            },
            password: {
                type: 'password',
                name: 'Password'
            }
        },

        accountNameFromProfileInfo: async context => {

            const { email, subdomain } = context;

            return subdomain + ' - ' + email;
        },

        requestProfileInfo: async context => {

            return {
                email: context.email,
                subdomain: context.subdomain
            };
        },

        validate: async context => {

            const { data, status, statusText } = await context.httpRequest({
                method: 'POST',
                url: `https://zapi.${context.subdomain}.zapoj.com/api/login`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    email: context.email,
                    password: context.password
                }
            });

            if (status === 200 && data?.authorization?.token) {

                return {
                    token: data.authorization.token,
                    // number/string with seconds representing a token lifetime
                    expires: data.token_lifetime
                };
            }

            // Currently POST to a URL with invalid domain returns 200 and HTML of the login page.
            let error = {
                subdomain: context.subdomain,
                status,
                statusText,
                data
            };

            throw new Error(JSON.stringify(error, null, 2));
        }
    }
};
