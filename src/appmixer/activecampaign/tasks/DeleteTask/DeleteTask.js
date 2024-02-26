'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const {
            taskId
        } = context.messages.in.content;

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        try {
            await ac.call('delete', `dealTasks/${taskId}`);
        } catch (e) {
            if (e.response.status !== 404) {
                throw (e);
            }
        }

        return context.sendJson({ taskId }, 'out');
    }
};
