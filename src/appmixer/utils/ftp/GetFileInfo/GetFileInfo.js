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

        let content;
        try {
            content = await client.list(path);
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

        // We assume the path points to a specific file, therefore, we take the first file info found.
        const firstFound = content && content[0];
        if (firstFound) {
            const fileInfo = JSON.parse(JSON.stringify(firstFound));
            return context.sendJson(fileInfo, 'out');
        }
    }
};
