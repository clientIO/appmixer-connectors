'use strict';

module.exports = {

    async receive(context) {

        const { data } = await context.httpRequest({
            url: 'https://messagetemplate.demo.zapoj.com/api/itTemplate/dashboardCount',
            headers: {
                authorization: `Bearer ${context.auth?.token}`
            }
        });

        context.sendJson(data.data, 'out');
    }
};
