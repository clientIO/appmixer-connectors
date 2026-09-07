'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { contactId } = context.messages.in.content;

        let data;
        try {
            const response = await apiCall(context, { url: `/contacts/${contactId}` });
            data = response.data;
        } catch (err) {
            if (err.response?.status === 404) {
                return context.sendJson({ contactId }, 'notFound');
            }
            throw err;
        }

        if (!data || !data.id) {
            return context.sendJson({ contactId }, 'notFound');
        }

        return context.sendJson({
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            mobile: data.mobile,
            twitterId: data.twitter_id,
            uniqueExternalId: data.unique_external_id,
            companyId: data.company_id,
            viewAllTickets: data.view_all_tickets,
            jobTitle: data.job_title,
            description: data.description,
            address: data.address,
            tags: data.tags,
            active: data.active,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'contact');
    }
};
