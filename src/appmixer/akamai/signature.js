const EdgeGrid = require('akamai-edgegrid');

module.exports = {
    generateAuthorizationHeader({ clientToken, clientSecret, accessToken, hostnameUrl, method, path, body, debug }) {
        const eg = new EdgeGrid(clientToken, clientSecret, accessToken, hostnameUrl, debug);

        const auth = eg.auth({
            path,
            method,
            body
        });

        return auth.request;
    }
};
