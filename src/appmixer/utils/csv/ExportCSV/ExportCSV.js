'use strict';

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const readStream = await context.getFileReadStream(fileId);

        return new Promise((resolve, reject) => {
            let content = '';
            readStream.on('data', (chunk) => {
                content += chunk;
            }).on('error', err => {
                reject(err);
            }).on('end', async () => {
                try {
                    await context.sendJson({ content }, 'content');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }
};
