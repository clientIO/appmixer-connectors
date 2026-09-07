'use strict';
const moment = require('moment');
const { apiCall } = require('../../lib');

function joinOrClauses(orArray) {

    return `(${orArray.join(' OR ')})`;
}

function joinAddClauses(andArray) {

    return `(${andArray.join(' AND ')})`;
}

function andMemberConvertor(andMember) {

    switch (andMember.field) {
        case 'agent':
            return convertOperatorField('agent_id', '=', andMember.agentId);
        case 'priority':
            return convertOperatorField('priority', andMember.priorityOperator, andMember.priorityValue);
        case 'status':
            return convertOperatorField('status', '=', andMember.status);
        case 'tag':
            return convertOperatorField('tag', '=', `'${andMember.tag}'`);
        case 'dueBy':
            return convertOperatorField('due_by', andMember.dueByOperator, `'${moment(andMember.dueByValue).format('YYYY-MM-DD')}'`);
        case 'frDueBy':
            return convertOperatorField('fr_due_by', andMember.frDueByOperator, `'${moment(andMember.frDueByValue).format('YYYY-MM-DD')}'`);
        case 'createdAt':
            return convertOperatorField('created_at', andMember.createdAtOperator, `'${moment(andMember.createdAtValue).format('YYYY-MM-DD')}'`);
        case 'updatedAt':
            return convertOperatorField('updated_at', andMember.updatedAtOperator, `'${moment(andMember.updatedAtValue).format('YYYY-MM-DD')}'`);
        default:
            return null;
    }
}

function convertOperatorField(field, operator, value) {

    if (operator === '=') {
        return `${field}:${value}`;
    }
    return `${field}:${operator}${value}`;
}

function getQuery(filters) {

    const or = filters['OR'];
    const andStatements = or.map((orElement) => {
        const andArray = orElement['AND'];
        const statements = andArray.map(andMemberConvertor);
        return joinAddClauses(statements);
    });

    return `"${joinOrClauses(andStatements)}"`;
}

module.exports = {

    async receive(context) {

        const { withFilters, limit, filters, allAtOnce } = context.messages.in.content;

        const perPage = withFilters ? 30 : 100;
        const pages = limit ? Math.ceil(limit / perPage) : 1;

        const params = {};
        let url;

        if (withFilters) {
            url = '/search/tickets';
            params.query = getQuery(filters);
        } else {
            url = '/tickets';
            params.per_page = perPage;
            params.updated_since = moment().subtract(30, 'years').format('YYYY-MM-DD');
        }

        let tickets = [];

        for (let i = 1; i <= pages; i++ ) {
            params.page = i;
            let { data } = await apiCall(context, { url, params });

            if (!Array.isArray(data)) {
                data = data.results;
            }

            if (data.length === 0) {
                break;
            }
            tickets = tickets.concat(data);
        }

        tickets = tickets.slice(0, limit);

        if (!allAtOnce) {
            return Promise.all(tickets.map(ticket => {
                return context.sendJson({
                    id: ticket.id,
                    createdAt: ticket.created_at,
                    updatedAt: ticket.updated_at,
                    dueBy: ticket.due_by,
                    frDueBy: ticket.fr_due_by,
                    subject: ticket.subject,
                    type: ticket.type,
                    source: ticket.source,
                    status: ticket.status,
                    priority: ticket.priority,
                    agentId: ticket.responder_id,
                    groupId: ticket.group_id,
                    emailConfigId: ticket.email_config_id,
                    productId: ticket.product_id,
                    tags: ticket.tags,
                    customFields: ticket.custom_fields,
                    ticketJson: ticket
                }, 'tickets');
            }));
        }
        return context.sendJson({ tickets }, 'tickets');
    },

    getQuery,

    ticketsToSelectArray({ tickets }) {
        return tickets.map(ticket => {
            return { label: ticket.subject, value: ticket.id };
        });
    }
};
