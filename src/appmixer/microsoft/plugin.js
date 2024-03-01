const path = require('path');

module.exports = function(context) {

    context.log('info', 'Initializing Microsoft SharePoint plugin.');

    context.http.router.register({
        method: 'GET',
        path: 'onedrive/picker',
        options: {
            handler: (request, h) => {
                return h.file(path.join(__dirname, 'sharepoint-picker-callback.html'), {
                    confine: false
                });
            },
            auth: false
        }
    });

    context.http.router.register({
        method: 'POST',
        path: '/OneDrivePicker',
        options: {
            handler: async (request, h) => {

                const { accountId } = await context.db.coreCollection('accountComponent')
                    .findOne({ componentId: request.payload.callerId });

                const user = await context.http.auth.getUser(request);
                const account = await context.db.coreCollection('accounts').findOne({ _id: accountId });

                if (!user.getId().equals(account.userId)) {
                    throw context.http.HttpError.forbidden('Unauthorized');
                }
                return {
                    clientId: context.config.clientId,
                    redirectUri: context.config.redirectUri,
                    loginHint: account.profileInfo.userPrincipalName
                };
            }
            // auth: false
        }
    });

    context.log('info', 'Microsoft SharePoint API added.');
};
