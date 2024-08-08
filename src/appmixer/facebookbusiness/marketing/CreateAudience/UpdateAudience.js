module.exports = {

    async receive(context) {

        const { audienceId } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        const fields = [
            'name',
            'description'
        ];

        const formData = new FormData();

        fields.forEach(field => {
            let value = context.messages.in.content[field];
            if (value) {
                formData.append(field, value);
            }
        });

        const url = `https://graph.facebook.com/v20.0/${audienceId}?access_token=${accessToken}`;

        const { data } = await context.httpRequest.post(url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        return context.sendJson(data, 'out');
    }
};
