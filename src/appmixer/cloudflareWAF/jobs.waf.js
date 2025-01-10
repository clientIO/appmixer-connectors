const CloudflareAPI = require('./CloudflareAPI');
const { Address4, Address6 } = require('ip-address');

const getModel = (context) => require('./RulesIPsModel')(context);

const deleteExpireIps = async function(context) {

    const expired = await getExpiredItems(context);

    if (expired.length) {
        await context.log('info', { type: '[Cloudflare WAF] expired.', data: sanitizeItems(expired) });
    }

    const rulesToUpdate = await retrieveRulesForUpdate(context, expired);
    if (rulesToUpdate.length) {
        await context.log('info', { type: '[Cloudflare WAF] rules to update.', data: sanitizeItems(rulesToUpdate) });
    }

    const dbItemsToDelete = await updateRules(context, rulesToUpdate);
    await deleteDBItems(context, dbItemsToDelete);
};

const retrieveRulesForUpdate = async function(context, expired = []) {

    const rulesToUpdate = [];
    const getRulePromises = expired.map(item => {
        const { auth, zoneId, rulesetId } = item;
        const client = new CloudflareAPI({ token: auth.token, zoneId });
        return client.getRules(context, rulesetId);
    });

    (await Promise.allSettled(getRulePromises)).forEach((result, i) => {

        const item = expired[i];

        if (result.status === 'fulfilled') {

            const { result: { rules = [] } } = result.value;
            const rule = rules.find(r => r.id === item.ruleId);
            if (rule) {
                rulesToUpdate.push({
                    ...item,
                    rule: removeIpsFromRule(rule, item?.ips?.map(i => i.ip))
                });
            }
        } else {
            context.log('info', {
                type: '[Cloudflare WAF] Unable to retrieve rule for expired item',
                data: sanitizeItems([item])
            });
        }
    });

    return rulesToUpdate;
};

const updateRules = async function(context, rulesToUpdate) {

    let dbItemsToDelete = [];
    const updatePromises = rulesToUpdate.map(ruleToUpdate => {

        const { zoneId, rulesetId, auth, rule } = ruleToUpdate;

        const client = new CloudflareAPI({ token: auth.token, zoneId });

        return client.updateBlockRule(context, rulesetId, rule);
    });

    (await Promise.allSettled(updatePromises)).forEach(async (result, i) => {

        const item = rulesToUpdate[i];
        const dbItems = item?.ips?.map(i => i.id) || [];

        if (result.status === 'fulfilled') {
            dbItemsToDelete = dbItemsToDelete.concat(dbItems);
        } else {
            context.log('info', {
                type: '[Cloudflare WAF] Unable to delete IPs from rule.',
                data: sanitizeItems([item])
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

    if (expired.length === 0) return [];

    const groupedByRules = expired.reduce((res, item) => {
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

    return Object.values(groupedByRules);
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

/**
 * remove sensitive info from objects
 * @param items
 * @returns {Omit<*, 'auth'>[]}
 */
function sanitizeItems(items = []) {

    return items.map(item => {
        // eslint-disable-next-line no-unused-vars
        const { auth, ...info } = item;
        return info;
    });
}

module.exports = {
    deleteExpireIps, getBlockExpression, extractIPs
};
