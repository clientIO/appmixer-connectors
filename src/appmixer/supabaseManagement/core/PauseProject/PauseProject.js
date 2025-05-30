'use strict';

module.exports = {
    async receive(context) {
        const { project_id } = context.messages.in.content;

        // https://supabase.com/docs/reference/api/projects-pause
        const data = await context.httpRequest({
            method: 'POST',
            url: `https://api.supabase.io/v1/projects/${project_id}/pause`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
            }
        });
        if (data.status !== 200) {
            throw new Error(`Failed to restore project: ${data.data.message}`);
        }
        else {
            return context.sendJson({projectID: project_id}, 'out');
        }
    }
};
