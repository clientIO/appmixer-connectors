'use strict';

module.exports = {
  async makeApiCall({ context, method = 'GET', data }) {

    const url = `https://${context.auth.regionPrefix}.nexl.cloud/api/graphql`;
    return context.httpRequest({
        method,
        url,
        headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${context.auth.apiKey}`
        },
        data
    });
}
};
