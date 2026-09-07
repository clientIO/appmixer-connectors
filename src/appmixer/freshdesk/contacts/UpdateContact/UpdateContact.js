'use strict';

const { apiCall, trimUndefined } = require('../../lib');

module.exports = {

    async receive(context) {

        const content = context.messages.in.content;

        const body = trimUndefined({
            name: content.name,
            email: content.email,
            phone: content.phone,
            mobile: content.mobile,
            twitter_id: content.twitterId,
            unique_external_id: content.uniqueExternalId,
            other_emails: content.otherEmails ? content.otherEmails.split(',').map(e => e.trim()) : undefined,
            company_id: content.companyId,
            view_all_tickets: content.viewAllTickets,
            description: content.description,
            job_title: content.jobTitle,
            tags: content.tags ? content.tags.split(',').map(t => t.trim()) : undefined,
            address: content.address
        });

        const response = await apiCall(context, {
            method: 'PUT',
            url: `/contacts/${content.contactId}`,
            data: body
        });

        const data = response.data;
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
            description: data.description,
            jobTitle: data.job_title,
            tags: data.tags,
            address: data.address,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            active: data.active
        }, 'contact');
    }
};
