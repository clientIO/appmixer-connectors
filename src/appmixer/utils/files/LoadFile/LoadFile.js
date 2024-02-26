'use strict';

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const readStream = await context.getFileReadStream(fileId);

        return new Promise((resolve, reject) => {
            let content = '';
            readStream.on('data', (chunk) => {
                content += chunk;
            });
            readStream.on('end', async () => {
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
