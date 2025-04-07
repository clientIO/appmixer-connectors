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
    },

    parseIPs(input) {

        let ips = [];

        if (typeof input === 'string') {
            // Check if the string is a JSON array
            try {
                const parsed = JSON.parse(input);
                if (Array.isArray(parsed)) {
                    ips = parsed;
                } else {
                    ips = input.split(/\s+|,/)
                        .filter(item => item)
                        .map(ip => ip.trim());
                }
            } catch (e) {
                ips = input.split(/\s+|,/)
                    .filter(item => item)
                    .map(ip => ip.trim());
            }
        } else if (Array.isArray(input)) {
            ips = input;
        }

        return ips;
    }

};
