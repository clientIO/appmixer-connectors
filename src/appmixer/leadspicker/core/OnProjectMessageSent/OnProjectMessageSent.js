const lib = require('../../lib');

const getProjectMessages = async function(context) {

    const { project_id: projectId } = context.properties;

    let url = lib.getBaseUrl(context) + `/app/sb/api/projects/${projectId}/sent-messages`;

    const headers = {};

    headers['X-API-Key'] = context.auth.apiKey;

    const { data } = await context.httpRequest({
        url: url,
        method: 'GET',
        headers: headers
    });

    return data.filter(item => item.message_type === 'email');
};

const messagesToState = function(messages) {

    return messages.map(item => {
        return { id: item.id, name: item.sent_date };
    });
};

module.exports = {

    async start(context) {

        const messages = await getProjectMessages(context);
        return await context.saveState({ messages: messagesToState(messages) });
    },

    async tick(context) {

        let lock;
        try {
            lock = await context.lock(context.componentId);

            let { messages } = await context.loadState();
            if (!messages) {
                messages = messagesToState(await getProjectMessages(context));
            }

            const latestMessages = await getProjectMessages(context);

            const newMessages = latestMessages.filter(item => {
                return !messages.find(message => message.id === item.id);
            });

            await context.saveState({ messages: messagesToState(latestMessages) });

            if (newMessages.length) {
                await context.sendArray(newMessages, 'out');
            }

        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    }
};
