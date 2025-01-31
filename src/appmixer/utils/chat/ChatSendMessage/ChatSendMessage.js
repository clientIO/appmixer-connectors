'use strict';

module.exports = {

    async receive(context) {

        let { chatId, content } = context.messages.in.content;
        const res = {
            chatId, content
        };
        return context.response(res, 200, { 'Content-Type': 'application/json' });
    }
};
