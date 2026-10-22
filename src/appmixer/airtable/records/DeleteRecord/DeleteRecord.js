'use strict';

module.exports = {

    async receive(context) {
        const { accessToken } = context.auth;
        const {
            baseId, tableIdOrName, recordId
        } = context.messages.in.content;
        if (!baseId) {
            throw new context.CancelError('Base ID is required');
        }

        if (!tableIdOrName) {
            throw new context.CancelError('Table ID or Name is required');
        }

        if (!recordId) {
            throw new context.CancelError('Record IDs is required');
        }


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

        return context.sendJson({ records }, 'out');
    }
};
