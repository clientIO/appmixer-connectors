'use strict';

module.exports = {

    async receive(context) {

        return context.sendJson({
            clientId: context.auth.clientId,
            loginHint: context.auth.profileInfo.userPrincipalName,
            redirectUri: context.auth.redirectUri
        }, 'out');
    }
};
