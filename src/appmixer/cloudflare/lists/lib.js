module.exports = {
    async fetchInputs(context, client, { account, accountsFetch, listFetch }) {

        try {
            if (accountsFetch) {
                const { data } = await client.callEndpoint(context, { action: '/accounts?per_page=50' });
                const items = data.result.map(item => {
                    return {
                        label: item.name,
                        value: item.id
                    };
                });

                return context.sendJson(items, 'out');
            }

            if (listFetch) {
                const { data } = await client.callEndpoint(context, { action: `/accounts/${account}/rules/lists` });
                const items = data.result.map(item => {
                    return {
                        label: item.name,
                        value: item.id
                    };
                });

                return context.sendJson(items, 'out');
            }

        } catch (e) {
            return context.sendJson([], 'out');
        }
    }
};
