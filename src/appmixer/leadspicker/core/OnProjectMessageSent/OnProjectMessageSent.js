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

    const lastItem = messages.slice(-1)[0] || { id: 0 };
    return {
        id: lastItem.id
    };
};

module.exports = {

    async start(context) {

        const messages = await getProjectMessages(context);
        return await context.saveState({ message: messagesToState(messages) });
    },

    async tick(context) {

        let lock;
        try {
            lock = await context.lock(context.componentId);

            let { message } = await context.loadState();
            if (!message) {
                message = messagesToState(await getProjectMessages(context));
            }

            const latestMessages = await getProjectMessages(context);

            const newMessages = latestMessages.filter(item => item.id > message.id);

            await context.saveState({ message: messagesToState(latestMessages) });

            if (newMessages.length) {
                await context.sendArray(newMessages, 'out');
            }

        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    async test(context) {

        // Read-only, no state: reuse the same fetch+filter path as tick() WITHOUT the
        // id baseline that start()/tick() use to suppress already-seen messages, so Flow
        // Test Mode emits the newest existing message in the exact shape tick() emits.
        const messages = await getProjectMessages(context);

        // messagesToState() treats the last element as the newest (highest id); mirror that.
        const latest = messages.slice(-1)[0];
        if (!latest) {
            throw new Error('No sent messages in the project to use as test data.');
        }

        return context.sendJson(latest, 'out');
    }
};
