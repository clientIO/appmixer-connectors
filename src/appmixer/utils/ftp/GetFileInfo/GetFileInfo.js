'use strict';
const FtpClient = require('../client');

module.exports = {

    async receive(context) {

        const { generateOutputPortOptions } = context.properties;
        const { secure } = context.auth;
        const config = FtpClient.createConfig(context.auth);

        const client = await FtpClient.getClientAndConnect(secure, config);
        const { path } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, FtpClient.isFtp(secure));
        }

        let content;
        try {
            content = await client.retrieveOne(path);
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
    },

    getOutputPortOptions(context, isFtp) {
        if (isFtp) {
            return context.sendJson([
                { label: 'Name', value: 'name', schema: { type: 'string' } },
                { label: 'Type', value: 'type', schema: { type: 'number' } },
                { label: 'Size', value: 'size', schema: { type: 'number' } },
                { label: 'Raw Modified At', value: 'rawModifiedAt', schema: { type: 'date' } },
                { label: 'Modifie dAt', value: 'modifiedAt', schema: { type: 'date' } }
            ], 'out');
        } else {
            return context.sendJson([
                { label: 'Name', value: 'name', schema: { type: 'string' } },
                { label: 'Type', value: 'type', schema: { type: 'number' } },
                { label: 'Size', value: 'size', schema: { type: 'number' } },
                { label: 'Modify Time', value: 'modifyTime', schema: { type: 'number' } },
                { label: 'Access Time', value: 'accessTime', schema: { type: 'number' } },
                { label: 'Rights', value: 'rights', schema: { type: 'object', properties: { user: { type: 'string', title: 'User' }, group: { type: 'string', title: 'Group' }, other: { type: 'string', title: 'Other' } } } },
                { label: 'Longname', value: 'longname', schema: { type: 'string' } }
            ], 'out');
        }
    }
};
