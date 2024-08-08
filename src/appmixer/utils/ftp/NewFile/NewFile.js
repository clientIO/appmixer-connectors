'use strict';
const FtpClient = require('../client');

module.exports = {

    async tick(context) {

        const { secure } = context.auth;
        const { path } = context.properties;
        const config = FtpClient.createConfig(context.auth);

        const client = await FtpClient.getClientAndConnect(secure, config);
        let content;
        try {
            content = await client.list(path);
        } finally {
            await client.close();
        }

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
    }
};
