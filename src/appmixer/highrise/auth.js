'use strict';
const request = require('request-promise');

module.exports = {

    type: 'oauth2',

    definition: () => {

        return {

            authUrl: context => {

                return `https://launchpad.37signals.com/authorization/new?` +
                    `type=web_server` +
                    `&client_id=${context.clientId}` +
                    `&redirect_uri=${context.callbackUrl}` +
                    `&state=${context.ticket}`;
            },

            accountNameFromProfileInfo: 'identity.email_address',

            get emailFromProfileInfo() { return this.accountNameFromProfileInfo; },

            requestProfileInfo: {
                method: 'GET',
                url: 'https://launchpad.37signals.com/authorization.json',
                auth: {
                    bearer: '{{accessToken}}'
                }
            },

            requestAccessToken: context => {

                return request({
                    method: 'POST',
                    url: 'https://launchpad.37signals.com/authorization/token',
                    json: true,
                    form: {
                        type: 'web_server',
                        'client_id': context.clientId,
                        'redirect_uri': context.callbackUrl,
                        'client_secret': context.clientSecret,
                        code: context.authorizationCode
                    }
                }).then(tokens => {
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (tokens['expires_in'] * 1000));
                    return {
                        accessToken: tokens['access_token'],
                        refreshToken: tokens['refresh_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            refreshAccessToken: context => {

                return request({
                    method: 'POST',
                    url: 'https://launchpad.37signals.com/authorization/token',
                    json: true,
                    form: {
                        type: 'refresh',
                        'client_id': context.clientId,
                        'client_secret': context.clientSecret,
                        'refresh_token': context.refreshToken
                    }
                }).then(tokens => {
                    let newDate = new Date();
                    newDate.setTime(newDate.getTime() + (tokens['expires_in'] * 1000));
                    return {
                        accessToken: tokens['access_token'],
                        accessTokenExpDate: newDate
                    };
                });
            },

            validateAccessToken: context => {

                return request({
                    method: 'GET',
                    url: 'https://launchpad.37signals.com/authorization.json',
                    json: true,
                    auth: {
                        bearer: context.accessToken
                    }
                }).then(response => {
                    if (response.error) {
                        throw new Error(response.error);
                    }
                    if ((new Date(response['expires_at'])).getTime() > Date.now()) {
                        return;
                    }
                    throw new Error('Token expired');
                });
            }
        };
    }
};
