'use strict';
const FtpClient = require('../client');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { host, username, password, secure, port } = context.auth;
        const { path, newPath } = context.messages.in.content;

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
        try {
            await client.rename(path, newPath);
        } catch (e) {
            if (e.code === 550) {
                return context.sendJson({
                    path,
                    errorCode: e.code,
                    errorMessage: 'File not found, or you don\'t have permissions to access it.'
                }, 'notFound');
            } else {
                throw e;
            }
        } finally {
            await client.close();
        }

        return context.sendJson({}, 'out');
    }
};
