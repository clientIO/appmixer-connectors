module.exports = {

    async receive(context) {

        const { accountId, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const accessToken = context.auth.accessToken;
        const url = `https://graph.facebook.com/v20.0/act_${accountId}/customaudiences?access_token=${accessToken}&fields=id,name,description`;
        const { data } = await context.httpRequest.get(url);
        return context.sendJson({ customAudiences: data.data }, 'out');
    },

    toSelectArray(out) {
        return (out.customAudiences || []).map(audience => {
            return {
                label: audience.name + ' (' + audience.id + ')',
                value: audience.id
            };
        });
    },

    fields: {
        id: {
            type: 'string',
            title: 'ID'
        },
        name: {
            type: 'string',
            title: 'Name'
        },
        description: {
            type: 'integer',
            title: 'Description'
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(this.fields).map(field => {
                const schema = this.fields[field];
                let label = field.split('_').join(' ');
                label = label.charAt(0).toUpperCase() + label.slice(1);
                return { label: schema.title || label, value: field, schema };
            });
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            return context.sendJson([{
                label: 'Custom Audiences',
                value: 'customAudiences',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: this.fields }
                }
            }], 'out');
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId' }
            ], 'out');
        }
    }
};
