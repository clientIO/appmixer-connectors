'use strict';

const { Api } = require('teleproto');
const lib = require('./lib');

class AuthError extends Error {}

// The auth context is not a component context: the auth fields sit directly on it and it
// has InvalidTokenError instead of CancelError. Everything the user has to fix (wrong API ID,
// revoked or bot session) is raised as InvalidTokenError, which is what makes the engine mark
// a connected account as invalid. FLOOD_WAIT and network failures stay plain errors, so a
// temporary problem never invalidates the account.
const libContext = (context) => ({
    auth: { apiId: context.apiId, apiHash: context.apiHash, session: context.session },
    CancelError: context.InvalidTokenError || AuthError
});

const getMe = async (authContext) => {

    const context = libContext(authContext);
    const client = await lib.getClient(context);
    const users = await lib.invoke(context, client, new Api.users.GetUsers({ id: [new Api.InputUserSelf()] }), 'your account');
    const user = (users || [])[0] || {};

    if (user.bot) {
        throw new context.CancelError(
            'This session belongs to a bot. Bots cannot read channels they are not members of - '
            + 'use the Telegram (bot) connector for bots, or log in with a user account here.'
        );
    }

    return user;
};

module.exports = {

    type: 'apiKey',

    name: 'appmixer:telegram:user',

    definition: () => {

        return {

            auth: {
                apiId: {
                    type: 'text',
                    name: 'API ID',
                    tooltip: 'Log in at <i>https://my.telegram.org</i>, open <i>API development tools</i>, create an '
                        + 'application and copy its numeric <i>App api_id</i>.'
                },
                apiHash: {
                    type: 'password',
                    name: 'API Hash',
                    tooltip: 'The <i>App api_hash</i> shown next to the API ID on my.telegram.org.'
                },
                session: {
                    type: 'password',
                    name: 'Session String',
                    tooltip: 'A pre-generated user session for the API ID above. Create it once on your own machine '
                        + 'by logging in with the teleproto library (<i>npm install teleproto</i>, then '
                        + '<i>client.start()</i> and <i>client.session.save()</i>), which asks for your phone number, '
                        + 'the login code and your 2FA password. The Telegram User page of the connector '
                        + 'configuration guide has a ready-made script. '
                        + 'The string grants full access to the Telegram account, so treat it as a password. '
                        + 'Generate a session just for this connection and do not use the same string in another '
                        + 'application at the same time - Telegram revokes a session that is used from two places '
                        + 'at once. Use a dedicated account if possible.'
                }
            },

            validate: async (context) => {

                await getMe(context);
                return true;
            },

            accountNameFromProfileInfo: 'accountName',

            // The phone number is deliberately not stored in the profile.
            requestProfileInfo: async (context) => {

                const user = await getMe(context);
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

                return {
                    accountName: user.username ? `@${user.username}` : (name || 'Telegram User'),
                    id: user.id ? String(user.id) : undefined,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName
                };
            }
        };
    }
};
