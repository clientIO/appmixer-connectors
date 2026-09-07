'use strict';

module.exports = {

    type: 'oauth2',

    definition: initData => {

        return {
            clientId: initData.clientId,
            clientSecret: initData.clientSecret,

            accountNameFromProfileInfo: 'name',

            scope: [
                'offline_access',
                'read:me'
            ],

            pre: function() {
                return {
                    jiraCloudSite: {
                        type: 'text',
                        name: 'JIRA Cloud Site',
                        tooltip: 'If you use multiple JIRA cloud sites, enter the site name you want to connect to. If you leave this empty, the first option in the select on the next page will be always used. Expected format: <sub_domain>.atlassian.net Note: If you enter a value here, the select on next page does not matter, the value here will be used as your JIRA domain.'
                    }
                };
            },

            authUrl(context) {

                const params = new URLSearchParams({
                    audience: 'api.atlassian.com',
                    client_id: context.clientId,
                    redirect_uri: context.callbackUrl,
                    state: context.ticket,
                    scope: context.scope.join(' '),
                    response_type: 'code',
                    prompt: 'consent'
                });

                return `https://auth.atlassian.com/authorize?${params.toString()}`;
            },

            async requestProfileInfo(context) {

                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: 'https://api.atlassian.com/oauth/token/accessible-resources',
                    headers: {
                        Authorization: `Bearer ${context.accessToken}`
                    }
                });

                // Normalize the jiraCloudSite URL to ensure it's in the correct format
                let normalizedUrl = context.jiraCloudSite;
                if (normalizedUrl) {
                    normalizedUrl = normalizedUrl.trim();
                    // Ensure it ends with .atlassian.net
                    if (!normalizedUrl.toLowerCase().endsWith('.atlassian.net')) {
                        normalizedUrl += '.atlassian.net';
                    }

                    // Ensure it starts with https://
                    if (!normalizedUrl.toLowerCase().startsWith('https://')) {
                        normalizedUrl = 'https://' + normalizedUrl;
                    }
                }

                // Find the cloudId by matching the normalized URL
                let cloudId;
                let name;
                if (normalizedUrl) {
                    const foundSite = data.find(site => site.url === normalizedUrl);
                    if (!foundSite) {
                        throw new Error(`JIRA Cloud Site "${context.jiraCloudSite}" not found. Available sites: ${data.map(site => site.url).join(', ')}`);
                    }
                    cloudId = foundSite.id;
                    name = foundSite.name;
                } else {
                    cloudId = data[0].id;
                    name = data[0].name;
                }

                const apiUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/`;

                // Fetch the authenticated user's accountId (needs read:me).
                // Stored on profileInfo so components can default to the connected
                // user — e.g. CreateProject leadAccountId.
                let accountId;
                try {
                    const me = await context.httpRequest({
                        method: 'GET',
                        url: 'https://api.atlassian.com/me',
                        headers: { Authorization: `Bearer ${context.accessToken}` }
                    });
                    accountId = me.data && me.data.account_id;
                } catch (err) {
                    // read:me not granted / call failed — leave accountId undefined.
                }

                return {
                    cloudId,
                    name,
                    accountId,
                    apiUrl,
                    updatedAt: new Date()
                };
            },

            async requestAccessToken(context) {

                const body = {
                    'grant_type': 'authorization_code',
                    'client_id': context.clientId,
                    'client_secret': context.clientSecret,
                    'code': context.authorizationCode,
                    'redirect_uri': context.callbackUrl
                };

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: 'https://auth.atlassian.com/oauth/token',
                    data: body
                });

                const {
                    access_token: accessToken,
                    expires_in: expiresIn,
                    refresh_token: refreshToken
                } = data;
                const accessTokenExpDate = new Date();
                accessTokenExpDate.setSeconds(accessTokenExpDate.getSeconds() + expiresIn);

                return { accessToken, accessTokenExpDate, refreshToken };
            },

            async refreshAccessToken(context) {

                const body = {
                    'grant_type': 'refresh_token',
                    'client_id': context.clientId,
                    'client_secret': context.clientSecret,
                    'refresh_token': context.refreshToken
                };

                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: 'https://auth.atlassian.com/oauth/token',
                    data: body
                });

                const {
                    access_token: accessToken,
                    expires_in: expiresIn,
                    refresh_token: refreshToken
                } = data;
                const accessTokenExpDate = new Date();
                accessTokenExpDate.setSeconds(accessTokenExpDate.getSeconds() + expiresIn);

                return { accessToken, accessTokenExpDate, refreshToken };
            },

            async validateAccessToken(context) {

                return context.accessTokenExpDate > new Date();
            }
        };
    }
};
