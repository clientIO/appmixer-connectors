module.exports = {

    async receive(context) {

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
    }
};
