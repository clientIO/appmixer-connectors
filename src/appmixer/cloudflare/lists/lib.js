const callEndpoint = async function(context, {
    action,
    method = 'GET',
    data,
    params
}) {

    const isApiTokenType = !context.auth.email;

    const headers = isApiTokenType ?
        { 'Authorization': `Bearer ${context.auth.apiKey}` } :
        {
            'X-Auth-Email': context.auth.email,
            'X-Auth-Key': context.auth.apiKey
        };

    headers['Content-Type'] = 'application/json';

    return context.httpRequest({
        method,
        url: `https://api.cloudflare.com/client/v4${action}`,
        headers,
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
    const notFound = [];
    for (let ipItem of ips) {

        try {
            const { data } = await callEndpoint(context, {
                method: 'GET',
                action: `/accounts/${account}/rules/lists/${list}/items`,
                params: {
                    per_page: 1,
                    search: ipItem
                }
            });
            if (data?.result[0] && data?.result.length === 1) {
                result.push({ ...data.result[0] });
            } else {
                notFound.push(ipItem);
            }

        } catch (err) {
            context.log({ step: `Invalid IP, IP ${ipItem} hasn't been found in the list ${list}` });
        }
    }

    return { items: result, notFound };

};

const parseIPs = function(input) {

    let ips = [];

    if (typeof input === 'string') {
        // Check if the string is a JSON array
        try {
            const parsed = JSON.parse(input);
            if (Array.isArray(parsed)) {
                ips = parsed;
            } else {
                ips = input.split(/\s+|,/)
                    .filter(item => item)
                    .map(ip => ip.trim());
            }
        } catch (e) {
            ips = input.split(/\s+|,/)
                .filter(item => item)
                .map(ip => ip.trim());
        }
    } else if (Array.isArray(input)) {
        ips = input;
    }

    return ips;
};

module.exports = {
    findIdsForIPs,
    fetchInputs,
    callEndpoint,
    parseIPs
};
