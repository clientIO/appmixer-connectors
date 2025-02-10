'use strict';

const uuid = require('uuid');

module.exports = {
    
    async receive(context) {
        
        let { threadId, content } = context.messages.in.content;
        const message = {
            id: uuid.v4(),
            content,
            role: 'agent',
            componentId: context.componentId,
            flowId: context.flowId

        };
        const res = await context.callAppmixer({
            endPoint: '/plugins/appmixer/utils/chat/messages/' + threadId,
            method: 'POST',
            body: message
        });
        return context.sendJson(res, 'out');
    }
};
