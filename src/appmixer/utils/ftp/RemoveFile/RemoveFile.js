'use strict';
const FtpClient = require('../client');

module.exports = {

    async receive(context) {

        const { secure } = context.auth;
        const { path } = context.messages.in.content;

        const config = FtpClient.createConfig(context.auth);

        const client = await FtpClient.getClientAndConnect(secure, config);
        try {
            await client.remove(path);
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
