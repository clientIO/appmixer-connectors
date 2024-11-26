'use strict';

module.exports = (context, options) => {

    const Rule = require('./RuleModel')(context);

    context.http.router.register({
        method: 'POST',
        path: '/rules',
        options: {
            handler: async req => {

                const payload = req.payload;

                return new Rule().populate({
                    ...payload,
                    created: new Date()
                }).save();
            }
        }
    });
};
