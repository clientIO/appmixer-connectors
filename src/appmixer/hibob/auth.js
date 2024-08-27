module.exports = {

    type: 'pwd',

    definition: {

        accountNameFromProfileInfo: 'serviceUserId',
        auth: {
            serviceUserId: {
                type: 'text',
                name: 'Servivce User Id',
                tooltip: 'Servivce User Id'
            },            
            serviceUserToken: {
                type: 'password',
                name: 'Token',
                tooltip: 'The service user token from your HiBob account'
            }
        },

        validate: async context => {

            const { serviceUserId, serviceUserToken } = context;
            const token = Buffer.from(serviceUserId + ':' + serviceUserToken).toString('base64');

            const auth = 'Basic ' + token;
            const url = 'https://api.hibob.com/v1/company/named-lists';

            try{
                await context.httpRequest({
                    method: 'GET',
                    url: url,
                    headers: {
                        'Authorization': auth
                    }
                });

            } catch (error) {
                throw new Error("Invalid id/token combination.");
            }

            return {
                token: token
            };
        }
    }
}