'use strict';
const Plivo = require('plivo');

module.exports = {

    receive(context) {

        const { accountSID, authenticationToken } = context.auth;
        const client = new Plivo.Client(accountSID, authenticationToken);
        // It seems plivo node driver takes care of paging (... but couldn't find confirmation in docs),
        // so we do not need to bother..
        const params = Object.assign({ /*limit: 5, offset: 0*/ }, context.messages.in.content);

        return client.numbers.list(params).then(response => {
            return context.sendJson(response, 'numbers');
        });
    },

    toSelectArray(numbersResponse) {

        if (Array.isArray(numbersResponse)) {
            return numbersResponse.map(num => ({
                content: num.id + ` [${num.alias} ${num.region}]`,
                value: num.id
            }));
        }
        return [];
    }
};
