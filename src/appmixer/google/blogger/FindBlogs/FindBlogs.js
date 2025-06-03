const lib = require('../lib.generated');
const schema = {
    'kind': { 'type': 'string', 'title': 'Kind' },
    'id': { 'type': 'string', 'title': 'Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'description': { 'type': 'string', 'title': 'Description' },
    'published': { 'type': 'string', 'title': 'Published' },
    'updated': { 'type': 'string', 'title': 'Updated' },
    'url': { 'type': 'string', 'title': 'Url' },
    'selfLink': { 'type': 'string', 'title': 'Self Link' }
};

module.exports = {
    async receive(context) {
        const { userId, fetchUserInfo, role, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Blogs', value: 'items' });
        }

        // https://developers.google.com/blogger/docs/3.0/reference/blogs/listByUser
        const { data } = await context.httpRequest({
            method: 'GET',
            url: '/v3/users/self/blogs',
            headers: {
                Authorization: `Bearer ${context.accessToken}`
            }
        });


        console.log(data);
        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'items' });
    }
};
