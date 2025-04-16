
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {        
        const {  } = context.messages.in.content;


        // https://docs.salt.security/reference/list-posture-gaps
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.salt.security/v1/posture/gaps',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });
    

return context.sendJson(data, 'out');
    }
};
