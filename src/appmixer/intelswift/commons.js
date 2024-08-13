module.exports = {

    async makeRequest(context, endpoint, { method = 'POST', params = {}, data = null, headers = {} } = {}) {

        const BASE_URL = context.config.BASE_URL || 'https://stage-app.intelswift.com';

        const options = {
            method,
            url: `${BASE_URL}/api/v1${endpoint}`,
            headers,
            data: {
                api_key: context.apiKey,
                ...data
            },
            params
        };


        console.log(options);
        return await context.httpRequest(options);
    }
};

