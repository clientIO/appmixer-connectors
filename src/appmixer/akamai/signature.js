const EdgeGrid = require('akamai-edgegrid');

module.exports = {
    generateAuthorizationHeader({ clientToken, clientSecret, accessToken, hostnameUrl, method, path, body }) {
        const debug = true;
        const eg = new EdgeGrid(clientToken, clientSecret, accessToken, hostnameUrl, debug);

        const auth = eg.auth({
            path,
            method,
            body: body ?? {}
        });

        return auth.request;
    }
};
