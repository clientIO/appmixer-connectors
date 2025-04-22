module.exports = {

    async makeRequest(context, endpoint, { method = 'POST', params = {}, data = null, headers = {} } = {}) {
        
        const BASE_URL = context.config.BASE_URL || 'https://stage-app.intelswift.com';
        if (!BASE_URL) throw 'BASE_URL not found';

        const ACCESS_KEY = context.config.ACCESS_KEY;
        

        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers,
            data: {
                api_key: `${context.apiKey}`,
                ...data,
                appSecret: ACCESS_KEY,
                config : JSON.stringify(context.config)
            },
            params
        };

        return await context.httpRequest(options);
    }
};

