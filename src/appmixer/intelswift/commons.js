module.exports = {

    async makeRequest(context, endpoint, { method = 'POST', params = {}, data = null, headers = {} } = {}) {

        const BASE_URL = context.config.BASE_URL || 'https://stage-app.intelswift.com';
        const ACCESS_KEY = context.config.ACCESS_KEY;

        if (!BASE_URL) {
            throw new context.CancelError('Missing BASE_KEY system setting of the appmixer.intelswift module. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        if (!ACCESS_KEY) {
            throw new context.CancelError('Missing ACCESS_KEY system setting of the appmixer.intelswift module. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers,
            data: {
                api_key: `${context.apiKey}`,
                ...data,
                appSecret: ACCESS_KEY,
                customFields: context.customFields
            },
            params
        };

        return await context.httpRequest(options);
    }
};

