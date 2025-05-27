'use strict';

/**
 * CreateLead action.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        let { title, ownerId = '', organizationId, amount, currency, visibleTo = '' } = context.messages.lead.content;

        const value = { amount, currency };
        const options = {
            method: 'POST',
            url: 'https://api.pipedrive.com/v1/leads',
            headers: {
                'x-api-token': context.auth.apiKey
            },
            data: {
                title,
                organization_id: organizationId,
                value
            }
        };

        if (visibleTo && visibleTo !== '') {
            options.data.visible_to = visibleTo;
        }

        if (ownerId && ownerId !== '') {
            options.data.owner_id = ownerId;
        }

        const result = await context.httpRequest(options);


        if (!result?.data?.success) {
            throw new context.CancelError(result?.data?.error || 'Unknown API error');
        }

        return context.sendJson(result.data.data, 'newLead');
    }
};
