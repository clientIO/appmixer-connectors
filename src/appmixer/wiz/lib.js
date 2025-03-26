module.exports = {

    async makeApiCall({ context, method = 'GET', data }) {

        const url = context.auth.url;

        return context.httpRequest({
            method,
            url,
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${context.auth.token}`
            },
            data
        });
    }
};

