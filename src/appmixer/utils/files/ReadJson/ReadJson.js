const { pipeline } = require('stream').promises;
const JSONStream = require('JSONStream');

module.exports = {

    async receive(context) {

        const { fileId, path = '*' } = context.messages.in.content;

        const readStream = await context.getFileReadStream(fileId);

        await pipeline(
            readStream,
            JSONStream.parse(path),
            async function(source, { signal }) {
                for await (const chunk of source) {
                    context.sendJson(chunk, 'out');
                }
            }
        );

        return context.sendJson({}, 'done');
    }
};
