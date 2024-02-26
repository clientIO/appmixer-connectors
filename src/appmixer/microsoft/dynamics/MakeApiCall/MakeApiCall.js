'use strict';

module.exports = {

    async receive(context) {

        const { url, method, body } = context.messages.in.content;

        const options = {
            method,
            url: (context.resource || context.auth.resource) + url,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${context.accessToken || context.auth?.accessToken}`
            },
            data: body
        };

        await context.log({ step: 'Making request', options });

        try {
            const { data, status, statusText } = await context.httpRequest(options);

            return context.sendJson({ response: data, status, statusText }, 'out');
        } catch (error) {
            // If Axios throws an error, the response is in error.response.data.
            const axiosError = error.response?.data;
            const axiosStatusCode = error.response?.status;
            // This propagates the error properly when the component is called by a different component.
            error.message = `${error.message}: ${axiosError?.error?.message || axiosError?.message || ''}`;
            throw error;
        }
    }
};
