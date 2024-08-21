module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const accessToken = context.auth.accessToken;
        const url = `https://graph.facebook.com/v20.0/me/adaccounts?access_token=${accessToken}&fields=id,account_id,name,account_status`;
        const { data } = await context.httpRequest.get(url);
        return context.sendJson({ accounts: data.data }, 'out');
    },

    toSelectArray(out) {
        return (out.accounts || []).map(account => {
            return {
                label: account.name + ' (' + account.account_id + ')',
                value: account.account_id
            };
        });
    },

    fields: {
        id: { type: 'string', title: 'ID (act_123)'  },
        account_id: { type: 'string', title: 'Account ID (123)' },
        name: { type: 'string' },
        account_status: { type: 'integer' }
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
                label: 'Accounts',
                value: 'accounts',
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
