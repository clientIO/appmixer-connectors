const lib = require('../lib.generated');
const schema = {
    'kind': { 'type': 'string', 'title': 'Kind' },
    'id': { 'type': 'string', 'title': 'Id' },
    'status': { 'type': 'string', 'title': 'Status' },
    'name': { 'type': 'string', 'title': 'Name' },
    'description': { 'type': 'string', 'title': 'Description' },
    'published': { 'type': 'string', 'title': 'Published' },
    'updated': { 'type': 'string', 'title': 'Updated' },
    'url': { 'type': 'string', 'title': 'Url' },
    'selfLink': { 'type': 'string', 'title': 'Self Link' },
    'posts': {
        'type': 'object',
        'properties': {
            'totalItems': { 'type': 'number', 'title': 'Posts.Total Items' },
            'selfLink': { 'type': 'string', 'title': 'Posts.Self Link' }
        },
        'title': 'Posts'
    },
    'pages': {
        'type': 'object',
        'properties': {
            'totalItems': { 'type': 'number', 'title': 'Pages.Total Items' },
            'selfLink': { 'type': 'string', 'title': 'Pages.Self Link' }
        },
        'title': 'Pages'
    },
    'locale': {
        'type': 'object',
        'properties': {
            'language': { 'type': 'string', 'title': 'Locale.Language' },
            'country': { 'type': 'string', 'title': 'Locale.Country' },
            'variant': { 'type': 'string', 'title': 'Locale.Variant' }
        },
        'title': 'Locale'
    }
};

module.exports = {
    async receive(context) {
        const { userId = 'self', role, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Blogs', value: 'items' });
        }

        const params = {};
        if (role) {
            params.view = role;
        }

        // https://developers.google.com/blogger/docs/3.0/reference/blogs/listByUser
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://www.googleapis.com/blogger/v3/users/${userId}/blogs`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            },
            params
        });

        return lib.sendArrayOutput({ context, records: data.items, outputType, arrayPropertyValue: 'items' });
    }
};
