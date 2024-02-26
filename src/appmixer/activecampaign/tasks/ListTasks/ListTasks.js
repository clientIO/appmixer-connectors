'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const {
            filter,
            limit = 100,
            title,
            relationship,
            contactId,
            dealId,
            status
        } = context.messages.in.content;

        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        let params = {};

        if (filter) {
            params['filters[title]'] = title;
            params['filters[reltype]'] = relationship;
            params['filters[relid]'] = relationship === 'Deal' ? dealId : contactId;
            params['filters[status]'] = status;

            params = trimUndefined(params);
        }

        const tasks = await ac.getTasks(params, limit);
        return context.sendJson({ tasks }, 'tasks');
    },

    tasksToSelectArray({ tasks }) {

        return tasks.map(task => {
            return { label: task.title, value: task.id };
        });
    }
};
