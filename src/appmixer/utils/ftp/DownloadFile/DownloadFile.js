'use strict';
const pathModule = require('path');
const { PassThrough } = require('stream');
const FtpClient = require('../client');
const lib = require('../lib');
const Promise = require('bluebird');

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
            const fileName = pathModule.basename(path);

            const pt = new PassThrough();
            const { saveFileStatus } = await Promise.props({
                downloadStatus: client.downloadFile(path, pt),
                saveFileStatus: context.saveFileStream(fileName, pt)
            });
            return context.sendJson(saveFileStatus, 'out');
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
    }
};
