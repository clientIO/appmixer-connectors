'use strict';

module.exports = (context, options) => {

    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);

    context.http.router.register({
        method: 'POST',
        path: '/rules-block-ips',
        options: {
            handler: async req => {

                const { ips, ruleId, siteId, removeAfter, auth } = req.payload;
                const created = new Date().getTime();

                // Create an array of BlockIPRuleModel records. One for each IP.
                const blockIPRules = ips.map(ip => ({
                    ruleId,
                    siteId,
                    removeAfter,
                    auth,
                    ip,
                    created
                }));

                await context.db.collection(BlockIPRuleModel.collection).insertMany(blockIPRules);

                return blockIPRules;
            }
        }
    });
};
