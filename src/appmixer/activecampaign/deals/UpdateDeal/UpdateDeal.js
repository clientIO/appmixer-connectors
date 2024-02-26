'use strict';
const moment = require('moment');
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const {
            dealId,
            contactId,
            title,
            description,
            value,
            currency,
            owner,
            stage,
            status,
            customFields = {}
        } = context.messages.in.content;

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        const payload = {
            deal: trimUndefined(
                {
                    contact: contactId,
                    title,
                    description,
                    currency: currency ? currency.toLowerCase() : currency,
                    value: value * 100,
                    owner,
                    stage,
                    status
                }
            )
        };

        const customFieldsValues = customFields.AND || [];
        const fieldValues = [];
        if (customFieldsValues.length > 0) {
            customFieldsValues.forEach(customField => {
                fieldValues.push({ customFieldId: customField.field, fieldValue: customField.value });
            });
            payload.deal.fields = fieldValues;
        }

        const { data } = await ac.call('put', `deals/${dealId}`, payload);
        const { deal } = data;

        const customFieldsPayload = fieldValues.reduce((acc, field) => {
            acc[`customField_${field.customFieldId}`] = field.fieldValue;
            return acc;
        }, {});

        return context.sendJson({
            id: deal.id,
            contactId: deal.contact,
            title: deal.title,
            description: deal.description,
            currency: deal.currency,
            value: deal.value / 100,
            owner: deal.owner,
            stage: deal.stage,
            status: deal.status,
            createdDate: moment(deal.cdate).toISOString(),
            ...customFieldsPayload
        }, 'deal');
    }
};
