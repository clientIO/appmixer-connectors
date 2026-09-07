'use strict';

const moment = require('moment');
const ActiveCampaign = require('./ActiveCampaign');

/**
 * Shared helpers for ActiveCampaign trigger `test()` methods (Flow Test Mode).
 *
 * Each `fetchLatest*` helper performs a READ-ONLY request for the single newest
 * matching record and reshapes it into the exact object the corresponding
 * webhook/polling trigger emits via `context.sendJson(item, '<port>')`.
 *
 * The reshape functions are the single source of truth for the emitted shape and
 * mirror what each trigger's `receive()`/`tick()` builds field-for-field.
 */

/**
 * Reshape a raw contact record (and optional fieldValues) into the object the
 * contacts.NewContact / contacts.UpdatedContact webhook triggers emit.
 */
function reshapeContact(contactInfo, fieldValues = []) {

    const contact = {
        id: contactInfo.id,
        email: contactInfo.email,
        firstName: contactInfo.firstName,
        lastName: contactInfo.lastName,
        phone: contactInfo.phone,
        createdDate: moment(contactInfo.cdate).toISOString()
    };

    fieldValues.forEach(field => {
        contact[`customField_${field.field}`] = field.value;
    });

    return contact;
}

/**
 * Reshape a raw deal record (and optional fieldValues) into the object the
 * deals.NewDeal / deals.UpdatedDeal webhook triggers emit.
 */
function reshapeDeal(deal, fieldValues = []) {

    const dealInfo = {
        id: deal.id,
        owner: deal.owner,
        contactId: deal.contact,
        organization: deal.organization,
        group: deal.group,
        stage: deal.stage,
        title: deal.title,
        description: deal.description,
        createdDate: moment(deal.cdate).toISOString(),
        value: deal.value / 100,
        currency: deal.currency
    };

    fieldValues.forEach(field => {
        dealInfo[`customField_${field.field}`] = field.value;
    });

    return dealInfo;
}

/**
 * Reshape a raw dealTask record into the object the tasks.NewTask webhook trigger
 * and tasks.UpdatedTask polling trigger emit.
 */
function reshapeTask(task) {

    return {
        id: task.id,
        relationship: task.owner.type,
        contactId: task.owner.type === 'contact' ? task.relid : undefined,
        dealId: task.owner.type === 'deal' ? task.relid : undefined,
        title: task.title,
        note: task.note,
        taskType: task.dealTasktype,
        assignee: task.assignee,
        due: moment(task.duedate).toISOString(),
        edate: moment(task.edate).toISOString()
    };
}

/**
 * Fetch the single newest contact ordered by the given date column and reshape
 * it to the webhook trigger output. Returns null when there are no contacts.
 * @param {Object} context
 * @param {string} orderColumn 'cdate' (new) or 'udate' (updated)
 */
async function fetchLatestContact(context, orderColumn) {

    const { auth } = context;
    const ac = new ActiveCampaign(auth.url, auth.apiKey, context);
    const contacts = await ac.getContacts({ [`orders[${orderColumn}]`]: 'DESC' }, 1);
    const contact = (contacts || [])[0];
    if (!contact) {
        return null;
    }

    // The webhook trigger re-fetches the contact by id to obtain fieldValues.
    const { data: getContact } = await ac.call('get', `contacts/${contact.id}`);
    const { contact: contactInfo, fieldValues = [] } = getContact;
    return reshapeContact(contactInfo, fieldValues);
}

/**
 * Fetch the single newest deal ordered by the given date column and reshape it
 * to the webhook trigger output. Returns null when there are no deals.
 * @param {Object} context
 * @param {string} orderColumn 'cdate' (new) or 'udate' (updated)
 */
async function fetchLatestDeal(context, orderColumn) {

    const { auth } = context;
    const ac = new ActiveCampaign(auth.url, auth.apiKey, context);
    const deals = await ac.getDeals({ [`orders[${orderColumn}]`]: 'DESC' }, 1);
    const deal = (deals || [])[0];
    if (!deal) {
        return null;
    }

    // The webhook trigger re-fetches the deal by id to obtain fieldValues.
    const { data: getDeal } = await ac.call('get', `deals/${deal.id}`);
    const { deal: dealInfo, fieldValues = [] } = getDeal;
    return reshapeDeal(dealInfo, fieldValues);
}

/**
 * Fetch the single newest dealTask ordered by the given date column and reshape
 * it to the trigger output. Returns null when there are no tasks.
 * @param {Object} context
 * @param {string} orderColumn 'cdate' (new) or 'udate' (updated)
 */
async function fetchLatestTask(context, orderColumn) {

    const { auth } = context;
    const ac = new ActiveCampaign(auth.url, auth.apiKey, context);
    const tasks = await ac.getTasks({ [`orders[${orderColumn}]`]: 'DESC' }, 1);
    const task = (tasks || [])[0];
    if (!task) {
        return null;
    }
    return reshapeTask(task);
}

module.exports = {
    reshapeContact,
    reshapeDeal,
    reshapeTask,
    fetchLatestContact,
    fetchLatestDeal,
    fetchLatestTask
};
