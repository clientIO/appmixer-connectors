'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { callbackQueryId, text, showAlert, url, cacheTime } = context.messages.in.content;

        if (!callbackQueryId) {
            throw new context.CancelError('Callback Query ID is required!');
        }

        // Telegram answers this method with `true`, not an object.
        const success = await lib.apiRequest(context, 'answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            text,
            show_alert: showAlert,
            url,
            cache_time: cacheTime
        });

        return context.sendJson({ success: success === true }, 'out');
    }
};
