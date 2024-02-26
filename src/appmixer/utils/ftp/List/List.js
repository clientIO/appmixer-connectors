'use strict';
const FtpClient = require('../client');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { host, username, password, secure, port } = context.auth;
        const { path } = context.messages.in.content;
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
        let content;
        try {
            content = await client.list(path);
        } finally {
            await client.close();
        }

        const contentJson = JSON.parse(JSON.stringify(content));
        return context.sendJson({ content: contentJson }, 'out');
    }
};
