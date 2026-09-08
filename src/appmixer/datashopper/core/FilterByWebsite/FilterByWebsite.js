'use strict';

module.exports = {

    receive(context) {

        let { sourceData = '', website = '' } = context.messages.in.content;
        if (sourceData == website) {
            return context.sendJson(context.messages.in.originalContent, 'equals');
        } else {
            return context.sendJson(context.messages.in.originalContent, 'notEquals');
        }
    }
};
