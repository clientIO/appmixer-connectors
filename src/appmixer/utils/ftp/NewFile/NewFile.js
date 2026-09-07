'use strict';
const FtpClient = require('../client');

// Shared by tick() and test(): connect, list the configured path, disconnect.
async function listFiles(context) {

    const { secure } = context.auth;
    const { path } = context.properties;
    const config = FtpClient.createConfig(context.auth);

    const client = await FtpClient.getClientAndConnect(secure, config);
    try {
        return await client.list(path);
    } finally {
        await client.close();
    }
}

module.exports = {

    async tick(context) {

        const content = await listFiles(context);

        const known = context.state.known;
        const current = {};

        // Detect new files.
        const newFiles = [];

        for (let i = 0; i < (content || []).length; i++) {
            const item = JSON.parse(JSON.stringify(content[i]));
            const name = item.name;

            if (known && !known[name]) {
                // Unseen file.
                newFiles.push(item);
            }
            current[name] = item;
        }

        await context.sendArray(newFiles, 'out');
        await context.saveState({ known: current });
    },

    async test(context) {

        // Polling-with-source: reuse the same listing path tick() uses, pick the newest
        // file, and emit exactly one item of the same shape. No state read/write.
        // Listing shape differs between FTP (basic-ftp: numeric type, modifiedAt Date) and
        // SFTP (ssh2-sftp-client: char type 'd', modifyTime epoch ms), so handle both.
        const isDirectory = item => item.type === 2 || item.type === 'd';
        const modifiedTime = item => {
            if (item.modifiedAt) return new Date(item.modifiedAt).getTime();
            if (item.modifyTime) return new Date(item.modifyTime).getTime();
            return 0;
        };

        const content = await listFiles(context);
        const files = (content || []).filter(item => !isDirectory(item));

        if (!files.length) {
            throw new Error('No files found at the configured path to use as test data.');
        }

        // Newest first by modification time, falling back to the last listed entry.
        files.sort((a, b) => modifiedTime(b) - modifiedTime(a));

        const item = JSON.parse(JSON.stringify(files[0]));
        return context.sendJson(item, 'out');
    }
};
