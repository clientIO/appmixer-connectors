'use strict';
const FtpClient = require('../client');
module.exports = {

    async receive(context) {

        const { secure } = context.auth;
        const config = FtpClient.createConfig(context.auth);

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
