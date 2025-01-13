const callEndpoint = async function(context, {
    action,
    method = 'GET',
    data,
    params
}) {

    return context.httpRequest({
        method,
        url: `https://api.cloudflare.com/client/v4${action}`,
        headers: {
            'Content-Type': 'application/json',
            'X-Auth-Email': context.auth.email,
            'X-Auth-Key': context.auth.apiKey
        },
        data,
        params
    });
};

const fetchInputs = async function(context, { account, accountsFetch, listFetch }) {

    try {
        if (accountsFetch) {
            const { data } = await callEndpoint(context, { action: '/accounts?per_page=50' });
            const items = data.result.map(item => {
                return {
                    label: item.name,
                    value: item.id
                };
            });

            return context.sendJson(items, 'out');
        }

        if (listFetch) {
            const { data } = await callEndpoint(context, { action: `/accounts/${account}/rules/lists` });
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
};

const findIdsForIPs = async function({ context, ips = [], account, list }) {

    const result = [];
    for (let ipItem of ips) {

        try {
            const { data } = await callEndpoint(context, {
                method: 'GET',
                action: `/accounts/${account}/rules/lists/${list}/items`,
                params: {
                    per_page: 1,
                    search: ipItem.ip
                }
            });
            if (data?.result[0] && data?.result.length === 1) {
                result.push({ ...data.result[0] });
            }

        } catch (err) {
            context.log({ stage: `Invalid IP, IP ${ipItem} hasn't been found in the list ${list}` });
        }
    }

    return result;
};

module.exports = {
    findIdsForIPs,
    fetchInputs,
    callEndpoint
};
