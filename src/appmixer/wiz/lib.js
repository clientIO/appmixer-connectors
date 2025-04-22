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
    },

    validateUploadStatus(context, { systemActivity }) {

        if (!systemActivity?.status || !systemActivity?.result) {
            throw new context.CancelError('Status activity is not valid', systemActivity);
        }

        if (systemActivity.status !== 'SUCCESS') {
            throw new context.CancelError('Status activity returned error, there is a issue in the security scan', systemActivity);
        }

        Object.keys(systemActivity.result).forEach(key => {
            const { incoming, handled } = systemActivity.result[key];
            if (handled < incoming) {
                throw new context.CancelError(`Invalid result. Not all findings has been handled, '${key}':.`, systemActivity);
            }
        });
    }
};

