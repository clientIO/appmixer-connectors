'use strict';

module.exports = (context, options) => {

    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);

    context.http.router.register({
        method: 'POST',
        path: '/rules-block-ips',
        options: {
            handler: async req => {

                const payload = req.payload;

                return new BlockIPRuleModel().populate({
                    ...payload,
                    created: new Date()
                }).save();
            }
        }
    });
};
