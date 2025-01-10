const CloudflareAPI = require('./CloudflareAPI');
const { Address4, Address6 } = require('ip-address');

const getModel = (context) => require('./RulesIPsModel')(context);

const deleteExpireIps = async function(context) {

    try {

        // db model items grouped by ruleId
        const expired = await getExpiredItems(context);

        if (Object.keys(expired).length) {
            await context.log('info', { type: '[CloudFlareWAF] expired.', expired });
        }

        const rulesToUpdate = await retrieveRulesForUpdate(context, expired);

        const dbItemsToDelete = await updateRules(context, rulesToUpdate);

        await deleteDBItems(context, dbItemsToDelete);

    } catch (e) {
        await context.log('error', {
            type: '[CloudFlareWAF] Unexpected error',
            error: context.utils.Error.stringify(e)
        });
    }
};

const retrieveRulesForUpdate = async function(context, expired) {

    const rulesToUpdate = [];
    const groups = Object.values(expired);
    const getRulePromises = groups.map(item => {
        const client = new CloudflareAPI({ token: item.auth.token, zoneId: item.zoneId });
        return client.getRules(context, item.rulesetId);
    });

    (await Promise.allSettled(getRulePromises)).forEach((result, i) => {

        const dbModelItem = groups[i];

        if (result.status === 'fulfilled') {

            const { result: { rules = [] } } = result.value;
            const rule = rules.find(r => r.id === dbModelItem.ruleId);
            if (rule) {
                rulesToUpdate.push({
                    model: dbModelItem, rule: removeIpsFromRule(rule, dbModelItem?.ips?.map(i => i.ip))
                });
            }
        } else {
            // eslint-disable-next-line no-unused-vars
            const { auth, ...info } = dbModelItem;
            context.log('info', { type: '[CloudFlareWAF] Unable to retrieve rule for expired item', data: info });
        }
    });

    return rulesToUpdate;
};

const updateRules = async function(context, rulesToUpdate) {

    let dbItemsToDelete = [];
    const updatePromises = rulesToUpdate.map(rulesToUpdate => {

        const { zoneId, rulesetId, auth, rule } = rulesToUpdate;
        const client = new CloudflareAPI({ token: auth.token, zoneId });

        return client.updateBlockRule(context, rulesetId, rule);
    });

    (await Promise.allSettled(updatePromises)).forEach(async (result, i) => {

        const item = rulesToUpdate[i];
        const dbItems = item?.ips?.map(i => i.id) || [];

        if (result.status === 'fulfilled') {
            dbItemsToDelete = dbItemsToDelete.concat(dbItems);
        } else {
            // eslint-disable-next-line no-unused-vars
            const { auth, ...info } = item;
            context.log('info', {
                type: '[CloudFlareWAF] Unable to delete IPs from rule.',
                data: info
            });
        }
    });

    return dbItemsToDelete;
};

const deleteDBItems = async function(context, ids = []) {

    if (ids.length) {
        await context.db.collection(getModel(context).collection)
            .deleteMany({ id: { $in: ids } });
    }
};

const getExpiredItems = async function(context) {

    const expired = await context.db.collection(getModel(context).collection)
        .find({ removeAfter: { $lt: Date.now() } })
        .toArray();

    return expired.reduce((res, item) => {
        const key = item.ruleId;
        res[key] = res[key] || { ips: [] };
        res[key].ips.push({ ip: item.ip, id: item.id });
        res[key].auth = item.auth;
        res[key].id = item.id;
        res[key].zoneId = item.zoneId;
        res[key].ruleId = item.ruleId;
        res[key].rulesetId = item.rulesetId;

        return res;
    }, {});
};

function removeIpsFromRule(rule, ipsToRemove = []) {
    const data = extractIPs(rule.expression);
    const ips = [];
    data.forEach(ip => {
        if (!ipsToRemove.includes(ip)) {
            ips.push(ip);
        }
    });

    const expression = getBlockExpression(ips);

    return { ...rule, expression };
}

function extractIPs(expression) {

    // Regular expression to match IP addresses within the curly braces
    // const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    // Extracting the section of the expression that contains the IPs

    const match = expression.match(/{([^}]+)}/);
    if (!match) {
        // If no match for IP address block found, return empty array
        return [];
    }

    const ipsBlock = match[1]; // This contains "192.0.2.0 192.0.2.2 192.0.2.3"
    return ipsBlock.split(' ');
}

function getBlockExpression(ips) {
    const ipv4 = ips.filter(ip => Address4.isValid(ip));
    const ipv6 = ips.filter(ip => Address6.isValid(ip));
    const formattedIpv6 = ipv6.length > 0 ? ipv6.map(ip => removeInterfaceIdentifierAndAddCidr(ip)) : ipv6;
    const allIps = [...ipv4, ...formattedIpv6].sort();

    return `(ip.src in {${allIps.join(' ')}})`;
}

function removeInterfaceIdentifierAndAddCidr(ip) {
    const networkPrefix = ip
        .split(':')
        .slice(0, 4)
        .join(':');
    return `${networkPrefix}::/64`;
}

module.exports = {
    deleteExpireIps, getBlockExpression, extractIPs
};
