'use strict';

module.exports = {
    async receive(context) {

        // https://cloud.google.com/apigee/docs/reference/apis/apigee/rest/v1/organizations/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://apigee.googleapis.com/v1/organizations',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        // Transform the response to a simpler format
        const organizations = data.organizations || [];
        const records = organizations.map(org => ({
            name: org.organization || org.name,
            projectId: org.projectId
        }));

        // Send all organizations at once
        await context.sendJson({
            organizations: records,
            count: records.length
        }, 'out');
    },

    toSelectOptions(out) {
        return out.organizations.map(item => {
            return { label: item.name, value: item.projectId };
        });
    }
};
