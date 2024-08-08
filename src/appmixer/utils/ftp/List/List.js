'use strict';
const FtpClient = require('../client');

module.exports = {

    async receive(context) {

        const { secure } = context.auth;
        const { path } = context.messages.in.content;
        const config = FtpClient.createConfig(context.auth);

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
