'use strict';

module.exports = {
    async receive(context) {
        const { projectId } = context.messages.in.content;

        // https://supabase.com/docs/reference/api/projects-pause
        const data = await context.httpRequest({
            method: 'POST',
            url: `https://api.supabase.com/v1/projects/${projectId}/pause`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });
        if (data.status !== 200) {
            throw new Error(`Failed to pause project: ${data.data.message}`);
        } else {
            return context.sendJson({ projectID: projectId }, 'out');
        }
    }
};
