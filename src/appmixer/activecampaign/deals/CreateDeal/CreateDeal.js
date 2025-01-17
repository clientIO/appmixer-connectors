'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const {
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
                    currency: currency.toLowerCase(),
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
                if (Object.keys(customField).length > 0) {
                    const cf = { customFieldId: customField.field, fieldValue: customField.value };
                    if (cf.customFieldId && cf.fieldValue) {
                        fieldValues.push(cf);
                    }
                }
            });
            payload.deal.fields = fieldValues;
        }

        const { data } = await ac.call('post', 'deals', payload);

        const { deal } = data;

        const customFieldsPayload = fieldValues.reduce((acc, field) => {
            acc[`customField_${field.customFieldId}`] = field.fieldValue;
            return acc;
        }, {});

        const dealResponseModified = {
            ...deal,
            value: deal.value / 100,
            createdDate: new Date(deal.cdate).toISOString(),
            ...customFieldsPayload
        };

        delete dealResponseModified.cdate;
        delete dealResponseModified.links;

        return context.sendJson(dealResponseModified, 'deal');
    }
};
