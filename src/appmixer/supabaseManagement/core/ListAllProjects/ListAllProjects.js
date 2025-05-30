'use strict';

module.exports = {
    async receive(context) {
        const data = await context.httpRequest({
            method: 'GET',
            url: 'https://api.supabase.com/v1/projects/',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        });
        return context.sendJson(data.data, 'out');
    },

    projectsToSelectArray({ projects }) {
        if (!Array.isArray(projects)) return [];
        return projects.map(project => ({
            label: project.name || 'Unnamed Project',
            value: project.id || ''
        }));
    }
};
