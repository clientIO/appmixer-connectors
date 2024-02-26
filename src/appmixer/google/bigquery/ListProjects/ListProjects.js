'use strict';

const commons = require('../../google-commons');
module.exports = {

    async receive(context) {

        const authClient = commons.getAuthLibraryOAuth2Client(context.auth);
        const res = await authClient.request({ url: 'https://cloudresourcemanager.googleapis.com/v1/projects' });
        const { projects } = res.data;

        return context.sendJson({ projects }, 'out');
    },

    toSelectArray({ projects }) {

        return projects.map(project => {
            return { label: project.projectId, value: project.projectId };
        });
    }

};
