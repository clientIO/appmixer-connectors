'use strict';

const lib = require('../../lib');

// `projects_v2_item` webhook payloads carry only the content node ID, never the
// repository. Resolving through the generic `node(id:)` field (instead of an
// issue-only lookup) keeps pull request and draft issue cards working too.
const query = `
    query($nodeId: ID!) {
        node(id: $nodeId) {
            __typename
            ... on Issue {
                id
                number
                title
                url
                state
                body
                repository { name nameWithOwner owner { login } }
                labels(first: 20) { nodes { name } }
                assignees(first: 20) { nodes { login } }
            }
            ... on PullRequest {
                id
                number
                title
                url
                state
                body
                isDraft
                repository { name nameWithOwner owner { login } }
                labels(first: 20) { nodes { name } }
                assignees(first: 20) { nodes { login } }
            }
            ... on DraftIssue {
                id
                title
                body
                creator { login }
                assignees(first: 20) { nodes { login } }
            }
        }
    }
`;

module.exports = {

    async receive(context) {

        const { nodeId } = context.messages.in.content;

        if (!nodeId) {
            throw new context.CancelError('Node ID is required!');
        }

        const data = await lib.graphqlRequest(context, query, { nodeId });
        const node = data?.node;

        if (!node) {
            return context.sendJson({}, 'notFound');
        }

        return context.sendJson({
            id: node.id,
            type: node['__typename'],
            number: typeof node.number === 'number' ? node.number : null,
            title: node.title || '',
            url: node.url || '',
            state: node.state || '',
            body: node.body || '',
            isDraft: node.isDraft === true,
            repository: {
                name: node.repository?.name || '',
                owner: node.repository?.owner?.login || '',
                nameWithOwner: node.repository?.nameWithOwner || ''
            },
            labels: (node.labels?.nodes || []).map(label => label.name),
            assignees: (node.assignees?.nodes || []).map(assignee => assignee.login)
        }, 'out');
    }
};
