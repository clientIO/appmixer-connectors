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

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://zapi.demo.zapoj.com/api/login',
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    email: context.email,
                    password: context.password
                }
            });
            if (data.authorization?.token) {

                return {
                    token: data.authorization.token,
                    // now + token_lifetime
                    expires: Date.now() + data.token_lifetime
                };
            }

            return false;
        }
    }
};
