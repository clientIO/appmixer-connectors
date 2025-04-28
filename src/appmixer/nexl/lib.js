'use strict';

module.exports = {
  async apiRequest(context, query) {

    context.log({context});
    context.log({query});
    const response = await context.httpRequest({
      method: 'POST',
      url: `https://${context.auth.regionPrefix}.nexl.cloud/graphql`,
      headers: {
        Authorization: `Bearer ${context.auth.apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        query
      }
    });
    context.log ({ step: 'response', response: response.data });
    return response.data;
  }
};
