'use strict';
const FtpClient = require('../client');

module.exports = {

    async receive(context) {

        const { secure } = context.auth;
        const config = FtpClient.createConfig(context.auth);

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
