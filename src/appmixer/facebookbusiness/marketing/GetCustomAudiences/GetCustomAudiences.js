module.exports = {

    async receive(context) {

        const { accountId } = context.messages.in.content;
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
    }
};
