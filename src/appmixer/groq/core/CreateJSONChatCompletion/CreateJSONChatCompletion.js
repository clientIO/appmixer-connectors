
'use strict';

const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {        

        const { messages|role, messages|content, parameters|temperature, parameters|max_tokens } = context.messages.in.content;


        // https://console.groq.com/docs/api-reference#json-chat-completion
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.groq.com/v1/chat/completion/json',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });
    

return context.sendJson(data, 'out');
    }
};
