'use strict';
const commons = require('../lib');

/**
 * Get all contacts, optionally scoped to a single account, together with their
 * related contact information (name, email, phone, ...).
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { accountId, campaignId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return commons.getContactOutputPortOptions(context, outputType);
        }

        const conditions = [];
        if (accountId) {
            conditions.push(`AccountId = '${commons.escapeSoql(accountId)}'`);
        }
        if (campaignId) {
            // A contact's campaign membership ("Campaign History") is a
            // many-to-many relation stored on the CampaignMember object, not a
            // field on Contact — filter with a SOQL semi-join.
            conditions.push(
                `Id IN (SELECT ContactId FROM CampaignMember WHERE CampaignId = '${commons.escapeSoql(campaignId)}')`
            );
        }
        const where = conditions.length ? conditions.join(' AND ') : null;
        const records = await commons.findContacts(context, { where });

        if (!records.length) {
            return context.sendJson({}, 'notFound');
        }

        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records
        });
    }
};
