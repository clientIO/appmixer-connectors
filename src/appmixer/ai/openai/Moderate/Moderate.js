'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { input } = context.messages.in.content;
        const { data } = await lib.request(context, 'post', '/moderations', {
            model: context.config.ModerateModel || 'text-moderation-latest',
            input
        });

        if (data.results) {
            const moderation = data.results[0];

            if (moderation.flagged) {
                return context.sendJson({ moderation, input }, 'IsFlagged');
            } else {
                return context.sendJson({ moderation, input }, 'NotFlagged');
            }
        }
    }
};
