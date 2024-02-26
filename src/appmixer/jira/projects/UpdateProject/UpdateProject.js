'use strict';
const commons = require('../../jira-commons');

module.exports = {
    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const project = context.messages.in.content;
        const id = project.id;
        delete project.id;

        try {
            const result = await commons.put(`${apiUrl}project/${id}`, auth, project);
            return context.sendJson(result, 'project');
        } catch (err) {
            const freePlanUpdateError = 'Changing permission schemes is not allowed on the Jira Software or Work Management Free plans.'
            const forbiddenUpdateError = 'Changing permission schemes is not allowed on the Jira Software or Core Free plans.'
            if (err.statusCode === 400 && err.message.includes(freePlanUpdateError)) {
                throw new Error('Due to limitations within JIRA API, updating projects is not working within Free plans.');
            }
            if (err.statusCode === 403 && err.message.includes(forbiddenUpdateError)) {
                const result = await commons.get(
                    `${apiUrl}project/${id}`,
                    auth
                );
                return context.sendJson(result, 'project');
            }
            throw err;
        }
    }
};
