const ruleDescription = 'Generated Rule';
const ruleRefPrefix = 'generated_rule';
const RULE_MAX_CAPACITY = 4096;

// extractIPs, getBlockExpression  are also used in jobs.waf. They cannot be here, as jobs.waf
// cannot require waf/lib, therefore these methods are defined in the jobs.waf.js file
const { extractIPs, getBlockExpression } = require('../jobs.waf');

module.exports = {
    getIpsFromRules,
    prepareRulesForCreateOrUpdate,
    getBlockRule,
    findIpsInRules,
    extractIPs
};

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


