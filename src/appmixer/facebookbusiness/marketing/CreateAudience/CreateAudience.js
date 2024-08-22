module.exports = {

    async receive(context) {

        const { accountId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const fields = [
            'name',
            'description',
            'customer_file_source',
            'subtype'
        ];

        const formData = new FormData();

        fields.forEach(field => {
            let value = context.messages.in.content[field];
            if (value) {
                formData.append(field, value);
            }
        });

        const url = `https://graph.facebook.com/v20.0/act_${accountId}/customaudiences?access_token=${accessToken}`;

        const { data } = await context.httpRequest.post(url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        return context.sendJson(data, 'out');
    }
};
