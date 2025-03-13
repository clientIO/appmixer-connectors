module.exports = {

    type: 'oauth2',

    definition: initData => {

        return {
            clientId: initData.clientId,
            clientSecret: initData.clientSecret,

            accountNameFromProfileInfo: 'name',

            scope: [
                'read:jira-work',
                'write:jira-work',
                'manage:jira-project',
                'manage:jira-configuration',
                'read:jira-user',
                'report:personal-data',
                'offline_access'
            ],

            authUrl(context) {

                return 'https://auth.atlassian.com/authorize?' +
                    'audience=api.atlassian.com&' +
                    `client_id=${encodeURIComponent(context.clientId)}&` +
                    `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                    `state=${encodeURIComponent(context.ticket)}&` +
                    `scope=${encodeURIComponent(context.scope.join(' '))}&` +
                    'response_type=code&prompt=consent';
            },

            async requestProfileInfo(context) {

                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: 'https://api.atlassian.com/oauth/token/accessible-resources',
                    headers: {
                        Authorization: `Bearer ${context.accessToken}`,
                    }
                });

                const { id: cloudId, name } = data[0];
                return {
                    cloudId,
                    name,
                    apiUrl: `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/`,
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
