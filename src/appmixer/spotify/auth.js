'use strict';

const API_BASE_URL = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Spotify authenticates the token endpoint with HTTP Basic (client id : client secret)
// rather than with credentials in the form body.
const basicAuthHeader = (context) => {
    return Buffer.from(`${context.clientId}:${context.clientSecret}`).toString('base64');
};

const toTokens = (data) => {

    const accessTokenExpDate = new Date();
    // Spotify access tokens live for an hour; the fallback only guards a malformed response.
    accessTokenExpDate.setTime(accessTokenExpDate.getTime() + ((data.expires_in || 3600) * 1000));

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        accessTokenExpDate
    };
};

module.exports = {

    type: 'oauth2',

    definition: {

        // `playlist-read-private` is needed to see private playlists in ListPlaylists
        // (and therefore in the Playlist dropdown); the two modify scopes cover
        // CreatePlaylist / AddItemsToPlaylist / ReplacePlaylistItems for both public
        // and private playlists. `user-library-modify` covers `DELETE /me/library`,
        // which replaced `DELETE /playlists/{id}/followers` in the February 2026
        // migration - the migration guide does not spell out the scope for a playlist
        // URI, so the library scope is requested as the safe superset. If a live run
        // shows the playlist-modify scopes are enough, drop it (and bump the bundle).
        scope: [
            'playlist-read-private',
            'playlist-modify-private',
            'playlist-modify-public',
            'user-library-modify'
        ],

        scopeDelimiter: ' ',

        authUrl: (context) => {

            const authorizationUrl = new URL('https://accounts.spotify.com/authorize');
            authorizationUrl.searchParams.set('client_id', context.clientId);
            authorizationUrl.searchParams.set('response_type', 'code');
            authorizationUrl.searchParams.set('redirect_uri', context.callbackUrl);
            authorizationUrl.searchParams.set('scope', context.scope.join(' '));
            authorizationUrl.searchParams.set('state', context.ticket);

            return authorizationUrl.toString();
        },

        requestAccessToken: async (context) => {

            const { data } = await context.httpRequest({
                method: 'POST',
                url: TOKEN_URL,
                headers: {
                    'Authorization': `Basic ${basicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    grant_type: 'authorization_code',
                    code: context.authorizationCode,
                    redirect_uri: context.callbackUrl
                }
            });

            return toTokens(data);
        },

        refreshAccessToken: async (context) => {

            const { data } = await context.httpRequest({
                method: 'POST',
                url: TOKEN_URL,
                headers: {
                    'Authorization': `Basic ${basicAuthHeader(context)}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: {
                    grant_type: 'refresh_token',
                    refresh_token: context.refreshToken
                }
            });

            const tokens = toTokens(data);

            // A refresh response only sometimes carries a new refresh token. Keep the
            // current one when it does not, otherwise the connection would be dropped
            // on the next refresh.
            if (!tokens.refreshToken) {
                tokens.refreshToken = context.refreshToken;
            }

            return tokens;
        },

        requestProfileInfo: async (context) => {

            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/me`,
                headers: {
                    'Authorization': `Bearer ${context.accessToken}`
                }
            });

            return data;
        },

        // `GET /v1/me` no longer returns `email`, `country` or `product`, so the
        // display name (falling back to the user id) is all there is to label the
        // connected account with. There is deliberately no `emailFromProfileInfo`.
        accountNameFromProfileInfo: (context) => {

            return context.profileInfo.display_name || context.profileInfo.id;
        },

        validateAccessToken: async (context) => {

            await context.httpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/me`,
                headers: {
                    'Authorization': `Bearer ${context.accessToken}`
                }
            });

            return true;
        }
    }
};
