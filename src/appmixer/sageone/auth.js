'use strict';
const sageone = require('./sageone-commons');

function getEnvVar(name, defaultValue, parser) {

    let envVar = process.env[name];
    return envVar ? (typeof parser === 'function' ? parser(envVar) : envVar) : defaultValue;
}

let clientSigningSecret = getEnvVar('SAGEONE_CLIENT_SIGNING_SECRET');
let userAgent = getEnvVar('SAGEONE_USER_AGENT');

module.exports = {

    type: 'oauth2',

    definition: {

        authUrl: context => {

            return 'https://www.sageone.com/oauth2/auth?' +
                `response_type=code&client_id=${context.clientId}` +
                `&redirect_uri=${context.callbackUrl}` +
                '&scope=full_access' +
                `&state=${context.ticket}`;
        },

        requestAccessToken: 'https://api.sageone.com/oauth2/token',

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: context => {

            return sageone.sageoneAPI(
                'GET',
                context.accessToken,
                'https://api.sageone.com/core/v2/user',
                userAgent,
                clientSigningSecret
            ).then(res => {
                res = JSON.parse(res);
                res['userAgent'] = userAgent;
                res['clientSigningSecret'] = clientSigningSecret;
                return res;
            });
        },

        refreshAccessToken: 'https://api.sageone.com/oauth2/token',

        refreshAccessTokenErrCallback: (err, context) => {

            if (err.error && err.error.error === 'invalid_grant') {
                throw new context.InvalidTokenError(err.error.error);
            }
            throw err;
        },

        validateAccessToken: context => {

            return sageone.sageoneAPI(
                'GET',
                context.accessToken,
                'https://api.sageone.com/core/v2/user',
                userAgent,
                clientSigningSecret
            );
        }
    }
};
