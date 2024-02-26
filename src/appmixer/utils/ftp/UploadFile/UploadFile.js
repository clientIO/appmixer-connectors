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
        const { path, fileId } = context.messages.in.content;
        const fileReadStream = await context.getFileReadStream(fileId);

        try {
            await client.put(fileReadStream, path);
        } catch (err) {
            if (err.code === 553) {
                throw new Error('Could not create file. Make sure that a \'Path\' is not an existing directory.');
            }
            throw err;
        } finally {
            await client.close();
        }

        return context.sendJson({ fileId }, 'out');
    }
};
