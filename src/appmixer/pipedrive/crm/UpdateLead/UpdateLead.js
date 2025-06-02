'use strict';

/**
 * UpdateLead action.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {

        const {
            id,
            title = '',
            ownerId = '',
            organizationId = '',
            amount = '',
            currency = '',
            visibleTo = ''
        } = context.messages.lead.content;

        const value = {};
        if (amount) value.amount = amount;
        if (currency) value.currency = currency;

        const data = {};

        if (organizationId) data.organization_id = organizationId;
        if (Object.keys(value).length > 0) data.value = value;
        if (title) data.title = title;
        if (visibleTo) data.visible_to = visibleTo;
        if (ownerId) data.owner_id = ownerId;

        const options = {
            method: 'PATCH',
            url: `https://api.pipedrive.com/v1/leads/${id}`,
            headers: {
                'x-api-token': context.auth.apiKey
            },
            data
        };

        const result = await context.httpRequest(options);

        if (!result?.data?.success) {
            throw new context.CancelError(result?.data?.error || 'Unknown API error');
        }

        return context.sendJson(result.data.data, 'lead');
    }
};
