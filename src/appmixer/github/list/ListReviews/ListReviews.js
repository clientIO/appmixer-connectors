'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'state'],
    properties: {
        'id': { 'type': 'integer', 'title': 'ID', 'example': 3512480011 },
        'nodeId': { 'type': 'string', 'title': 'Node ID', 'example': 'PRR_kwDOAA12oc6abcde' },
        'state': { 'type': 'string', 'title': 'State', 'example': 'CHANGES_REQUESTED' },
        'body': { 'type': 'string', 'title': 'Body', 'example': 'Looks good overall, two small things inline.' },
        'htmlUrl': { 'type': 'string', 'title': 'HTML URL', 'example': 'https://github.com/Appmixer-ai/appmixer-connectors/pull/1259#pullrequestreview-3512480011' },
        'commitId': { 'type': 'string', 'title': 'Commit ID', 'example': '6dcb09b5b57875f334f61aebed695e2e4193db5e' },
        'submittedAt': { 'type': 'string', 'title': 'Submitted At', 'example': '2026-09-09T11:27:45Z' },
        'authorAssociation': { 'type': 'string', 'title': 'Author Association', 'example': 'MEMBER' },
        'userLogin': { 'type': 'string', 'title': 'User Login', 'example': 'Copilot' },
        'userId': { 'type': 'integer', 'title': 'User ID', 'example': 198982749 },
        'userType': { 'type': 'string', 'title': 'User Type', 'example': 'Bot' }
    }
};

/**
 * Component for listing every review submitted on a pull request.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { repositoryId, pullRequestNumber, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Reviews' });
        }

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!pullRequestNumber) {
            throw new context.CancelError('Pull Request Number is required!');
        }

        const reviews = await lib.apiRequestPaginated(
            context,
            `repos/${repositoryId}/pulls/${pullRequestNumber}/reviews`
        );

        const records = reviews.map(review => ({
            id: review.id,
            nodeId: review.node_id,
            state: review.state,
            body: review.body,
            htmlUrl: review.html_url,
            commitId: review.commit_id,
            submittedAt: review.submitted_at,
            authorAssociation: review.author_association,
            userLogin: review.user?.login,
            userId: review.user?.id,
            userType: review.user?.type
        }));

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
