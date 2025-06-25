const lib = require('../lib.generated');
const { contactGroupSchema } = require('./../schemas');

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, contactGroupSchema, { label: 'Contact Groups', value: 'result' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/contactGroups',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        if (!Array.isArray(data.contactGroups) || !data.contactGroups.length) {
            return context.sendJson({}, 'notFound');
        }

        const records = data.contactGroups.map((contactGroup) => {
            return {
                id: contactGroup.resourceName.split('/')[1],
                etag: contactGroup.etag ?? undefined,
                updateTime: contactGroup.metadata?.updateTime,
                groupType: contactGroup.groupType,
                name: contactGroup.name,
                formattedName: contactGroup.formattedName
            };
        });

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
