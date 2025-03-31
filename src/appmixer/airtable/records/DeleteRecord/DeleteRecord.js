'use strict';

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        const {
            baseId, tableIdOrName, recordId
        } = context.messages.in.content;

        const queryParams = {
            records: recordId.split(',')
        };

        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableIdOrName}`,
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
            params: queryParams
        });

        const { records } = data;

        context.sendJson({ records }, 'out');
    }
};
