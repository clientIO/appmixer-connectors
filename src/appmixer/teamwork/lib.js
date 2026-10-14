const querystring = require('querystring');

/**
 * Builds a valid URL by combining base URL, path, and query parameters
 * @param {string} baseURL - The base URL (with or without trailing slash)
 * @param {string} path - The path (with or without leading slash)
 * @param {Object} query - Query parameters object
 * @returns {string} The complete URL with properly encoded query string
 */
function buildURL(baseURL, path, query) {
    // Normalize baseURL (remove trailing slash if present)
    let normalizedBase = baseURL;
    if (normalizedBase.endsWith('/')) {
        normalizedBase = normalizedBase.slice(0, -1);
    }

    // Normalize path (ensure leading slash if path is provided)
    let normalizedPath = path || '';
    if (normalizedPath && !normalizedPath.startsWith('/')) {
        normalizedPath = '/' + normalizedPath;
    }

    // Build full URL
    let fullUrl = normalizedBase + normalizedPath;

    // Add query parameters using URLSearchParams for proper encoding
    if (query !== null && query !== undefined) {
        // Filter out undefined values from query object
        const filteredQuery = Object.fromEntries(
            Object.entries(query).filter(([_, v]) => v !== undefined)
        );
        
        if (Object.keys(filteredQuery).length > 0) {
            const searchParams = new URLSearchParams(filteredQuery);
            fullUrl += '?' + searchParams.toString();
        }
    }

    return fullUrl;
}

module.exports = {
    buildURL,
    
    async callAPI(context, method, url, body, query) {
        const fullUrl = buildURL(
            context.auth.profileInfo.accountURL,
            url,
            query
        );

        let req = {
            url: fullUrl,
            method: method,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'X-Teamwork-Product': 'appmixer'
            },
            json: true
        }

        if (body !== null && body !== undefined) {
            req.data = body;
        }

        const resp = await context.httpRequest(req);

        return resp.data
    }
}

