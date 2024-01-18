const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const {
            properties,
            ids
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const idsArray = ids ? ids.split(',') : [];

        const payload = {
            'inputs': idsArray.map(id => {
                return { id: id.trim() };
            }),
            'properties': properties ? properties.split(',') : []
        };

        context.log({ stage: 'Engagements - GetEmails payload ', payload });

        const { data } = await hs.call(
            'post',
            'crm/v3/objects/emails/batch/read',
            payload
        );

        if (data.errors) {
            throw new context.CancelError('Error occurred:', data.errors);
        }

        return context.sendJson(data, 'out');
    }
};
