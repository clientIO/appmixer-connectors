'use strict';

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const { input, model } = context.messages.in.content;
        if (!input) {
            throw new context.CancelError('Text is required');
        }


        const { data } = await lib.request(context, 'post', '/moderations', {
            model: model || context.config.ModerateModel || 'omni-moderation-latest',
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
