'use strict';
const FtpClient = require('../client');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { host, username, password, secure, port } = context.auth;
        const config = {
            host: host,
            user: username,
            password: password,
            secure: lib.getAccessSecureType(secure)
        };
        if (port) {
            config.port = port;
        }

        const client = await FtpClient.getClientAndConnect(secure, config);
        const { path } = context.messages.in.content;
        try {
            await client.createDir(path);
        } finally {
            await client.close();
        }

        return context.sendJson({}, 'out');
    }
};
