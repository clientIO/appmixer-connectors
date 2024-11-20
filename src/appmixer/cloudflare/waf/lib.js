const { Address4, Address6 } = require('ip-address');
const ruleDescription = 'Salt detected high severity attacker';
const ruleRefPrefix = 'SALT';
const RULE_MAX_CAPACITY = 4096;

module.exports = {
    extractIPs,
    getIpsFromRules,
    prepareRulesForCreateOrUpdate,
    getBlockRule,
    findIpsInRules,
    removeIpsFromRule
};

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

function getIpsFromRules(rules) {

    const ips = {};
    rules.forEach(rule => {

        const data = extractIPs(rule.expression);
        data.forEach(ip => {
            ips[ip] = { id: rule.id };
        });
    });

    return ips;
}

function findIpsInRules(rules, refIps = []) {

    const ips = {};
    rules.forEach(rule => {

        const ipsFromRule = extractIPs(rule.expression);
        ipsFromRule.forEach(ip => {
            if (refIps.includes(ip)) {
                ips[ip] = { id: rule.id };
            }
        });
    });

    return ips;
}

function prepareRulesForCreateOrUpdate(ips, rules, ruleCapacity) {
    const ipsList = assignIpsToRules(ips, rules, ruleCapacity);

    const ipsGroupedByRules = Object.keys(ipsList).reduce((acc, ip) => {
        const ruleId = ipsList[ip].id;
        if (!acc[ruleId]) acc[ruleId] = [];
        acc[ruleId].push(ip);
        return acc;
    }, {});

    const res = [];
    const groups = Object.entries(ipsGroupedByRules);
    groups.forEach(entry => {
        const ruleId = entry[0];
        const existingRule = rules.find(rule => rule.id === ruleId);
        const expression = getBlockExpression(entry[1]);

        if (existingRule) {
            if (existingRule.expression !== expression) {
                res.push({ ...existingRule, expression });
            }
        } else {
            res.push(this.getBlockRule(groups.length, entry[1]));
        }
    });
    return res;
}

function getBlockRule(index, ips) {
    return {
        action: 'block',
        description: `${ruleDescription}#${index}`,
        enabled: true,
        expression: getBlockExpression(ips),
        ref: `${ruleRefPrefix}#${index}`
    };
}

function assignIpsToRules(ips, rules, ruleCapacity) {
    const ipsList = getIpsFromRules(rules);
    const rulesMetadata = rules.map(rule => {
        return {
            id: rule.id,
            usedCapacity: rule.expression.length
        };
    });

    ips.forEach(ip => {

        const availableRule = getAvailableRule(rulesMetadata, ip.length + 1, ruleCapacity);

        if (availableRule) {
            availableRule.usedCapacity += ip.length + 1;
            ipsList[ip] = { id: availableRule.id };
        } else {
            ipsList[ip] = { id: 'NULL', expression: '' };
        }
    });

    return ipsList;
}

function getAvailableRule(rules, requiredCapacity, ruleCapacity = RULE_MAX_CAPACITY) {

    return rules.find(rule => rule.usedCapacity + requiredCapacity < ruleCapacity);
}

function removeInterfaceIdentifierAndAddCidr(ip) {
    const networkPrefix = ip
        .split(':')
        .slice(0, 4)
        .join(':');
    return `${networkPrefix}::/64`;
}

function getBlockExpression(ips) {
    const ipv4 = ips.filter(ip => Address4.isValid(ip));
    const ipv6 = ips.filter(ip => Address6.isValid(ip));
    const formattedIpv6 = ipv6.length > 0
        ? ipv6.map(ip => removeInterfaceIdentifierAndAddCidr(ip))
        : ipv6;
    const allIps = [...ipv4, ...formattedIpv6].sort();

    return `(ip.src in {${allIps.join(' ')}})`;
}


