'use strict';
const readline = require('readline');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const readStream = await context.getFileReadStream(fileId);
        const rl = readline.createInterface({
            input: readStream,
            crlfDelay: Infinity
        });
        let index = 0;
        for await (const line of rl) {
            await context.sendJson({ line, index }, 'content');
            index++;
        }
    }
};
