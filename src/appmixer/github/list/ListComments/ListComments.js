'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'body'],
    properties: {
        'id': { 'type': 'integer', 'title': 'ID', 'example': 2384759211 },
        'nodeId': { 'type': 'string', 'title': 'Node ID', 'example': 'IC_kwDOAA12oc6abcde' },
        'body': { 'type': 'string', 'title': 'Body', 'example': '<!-- agent-log -->\nRun started.' },
        'htmlUrl': { 'type': 'string', 'title': 'HTML URL', 'example': 'https://github.com/Appmixer-ai/appmixer-components/issues/2834#issuecomment-2384759211' },
        'createdAt': { 'type': 'string', 'title': 'Created At', 'example': '2026-09-04T11:27:45Z' },
        'updatedAt': { 'type': 'string', 'title': 'Updated At', 'example': '2026-09-04T11:31:02Z' },
        'authorAssociation': { 'type': 'string', 'title': 'Author Association', 'example': 'MEMBER' },
        'userLogin': { 'type': 'string', 'title': 'User Login', 'example': 'octocat' },
        'userId': { 'type': 'integer', 'title': 'User ID', 'example': 583231 }
    }
};

/**
 * Component for listing all comments of an issue or pull request.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { repositoryId, issueNumber, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Comments' });
        }

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!issueNumber) {
            throw new context.CancelError('Issue Number is required!');
        }

        const comments = await lib.apiRequestPaginated(
            context,
            `repos/${repositoryId}/issues/${issueNumber}/comments`
        );

        const records = comments.map(comment => ({
            id: comment.id,
            nodeId: comment.node_id,
            body: comment.body,
            htmlUrl: comment.html_url,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            authorAssociation: comment.author_association,
            userLogin: comment.user?.login,
            userId: comment.user?.id
        }));

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
