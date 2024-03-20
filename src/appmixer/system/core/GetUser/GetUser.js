'use strict';

module.exports = {

    receive: async function(context) {

        const { userId } = context.messages.in.content;
        const user = await context.callAppmixer({ endPoint: '/users/' + userId, method: 'GET' });
        return context.sendJson(user, 'out');
    }
};
