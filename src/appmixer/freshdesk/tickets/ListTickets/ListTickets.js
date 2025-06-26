'use strict';
const axios = require('axios');
const moment = require('moment');

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

        const { auth } = context;
        const { withFilters, limit, filters, allAtOnce } = context.messages.in.content;

        const requestObject = {
            auth: {
                username: auth.apiKey,
                password: 'X'
            }
        };

        const perPage = withFilters ? 30 : 100;
        const pages = limit ? Math.ceil(limit / perPage) : 1;

        requestObject.params = {};

        let url;

        if (withFilters) {
            const query = getQuery(filters);
            url = `https://${auth.domain}.freshdesk.com/api/v2/search/tickets`;
            requestObject.params.query = query;
        } else {
            requestObject.params.per_page = perPage;
            requestObject.params.updated_since = moment().subtract(30, 'years').format('YYYY-MM-DD');
            url = `https://${auth.domain}.freshdesk.com/api/v2/tickets`;
        }

        let tickets = [];

        for (let i = 1; i <= pages; i++ ) {
            requestObject.params.page = i;
            let { data } = await axios.get(url, requestObject);

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
                    created_at: ticket.created_at,
                    due_by: ticket.due_by,
                    subject: ticket.subject,
                    type: ticket.type,
                    status: ticket.status,
                    priority: ticket.priority,
                    agentId: ticket.responder_id,
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
