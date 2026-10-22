'use strict';

const INTEGRATION_HEADER = 'X-Pplx-Integration';

function addIntegrationHeader(url, headers) {

    const hasIntegrationHeader = Object.keys(headers)
        .some(name => name.toLowerCase() === INTEGRATION_HEADER.toLowerCase());

    return new URL(url).origin === 'https://api.perplexity.ai' && !hasIntegrationHeader
        ? { ...headers, [INTEGRATION_HEADER]: 'appmixer' }
        : headers;
}

module.exports = { addIntegrationHeader };
