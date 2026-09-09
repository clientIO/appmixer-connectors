'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'isResolved'],
    properties: {
        'id': { 'type': 'string', 'title': 'Thread ID', 'example': 'PRRT_kwDOAA12oc5abcde' },
        'isResolved': { 'type': 'boolean', 'title': 'Is Resolved', 'example': false },
        'isOutdated': { 'type': 'boolean', 'title': 'Is Outdated', 'example': true },
        'isCollapsed': { 'type': 'boolean', 'title': 'Is Collapsed', 'example': true },
        'path': { 'type': 'string', 'title': 'Path', 'example': 'src/appmixer/github/lib.js' },
        'line': { 'type': 'integer', 'title': 'Line', 'example': 42 },
        'startLine': { 'type': 'integer', 'title': 'Start Line', 'example': 38 },
        'diffSide': { 'type': 'string', 'title': 'Diff Side', 'example': 'RIGHT' },
        'commentCount': { 'type': 'integer', 'title': 'Comment Count', 'example': 2 },
        'firstCommentId': { 'type': 'integer', 'title': 'First Comment ID', 'example': 2384759211 },
        'firstCommentBody': { 'type': 'string', 'title': 'First Comment Body', 'example': 'This loop can be replaced by a single map().' },
        'firstCommentUrl': { 'type': 'string', 'title': 'First Comment URL', 'example': 'https://github.com/Appmixer-ai/appmixer-connectors/pull/1259#discussion_r2384759211' },
        'firstCommentAuthor': { 'type': 'string', 'title': 'First Comment Author', 'example': 'copilot-pull-request-reviewer' }
    }
};

const query = `
    query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
        repository(owner: $owner, name: $name) {
            pullRequest(number: $number) {
                reviewThreads(first: 100, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        isResolved
                        isOutdated
                        isCollapsed
                        path
                        line
                        startLine
                        diffSide
                        comments(first: 1) {
                            totalCount
                            nodes {
                                databaseId
                                body
                                url
                                author { login }
                            }
                        }
                    }
                }
            }
        }
    }
`;

/**
 * Component for listing the review threads of a pull request, including whether each one
 * is resolved. Resolution exists only in GitHub's GraphQL API — a REST review comment has
 * no `resolved` field at all — so this is the only way to see it.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            repositoryId,
            pullRequestNumber,
            resolvedState = 'any',
            outputType = 'array'
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Review Threads' });
        }

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!pullRequestNumber) {
            throw new context.CancelError('Pull Request Number is required!');
        }

        const [owner, name] = String(repositoryId).split('/');
        if (!owner || !name) {
            throw new context.CancelError(`Repository '${repositoryId}' is not in the 'owner/repo' form.`);
        }

        const nodes = [];
        let cursor = null;
        let hasNextPage = true;

        while (hasNextPage) {
            const data = await lib.graphqlRequest(context, query, {
                owner,
                name,
                number: Number(pullRequestNumber),
                cursor
            });

            const pullRequest = data?.repository?.pullRequest;
            if (!pullRequest) {
                throw new context.CancelError(`Pull request #${pullRequestNumber} not found in '${repositoryId}'.`);
            }

            nodes.push(...(pullRequest.reviewThreads?.nodes || []));

            const pageInfo = pullRequest.reviewThreads?.pageInfo;
            hasNextPage = !!pageInfo?.hasNextPage;
            cursor = pageInfo?.endCursor;
        }

        const wanted = nodes.filter(thread => {
            if (resolvedState === 'resolved') return thread.isResolved === true;
            if (resolvedState === 'unresolved') return thread.isResolved === false;
            return true;
        });

        const records = wanted.map(thread => {
            const firstComment = thread.comments?.nodes?.[0];
            return {
                id: thread.id,
                isResolved: thread.isResolved,
                isOutdated: thread.isOutdated,
                isCollapsed: thread.isCollapsed,
                path: thread.path,
                line: thread.line,
                startLine: thread.startLine,
                diffSide: thread.diffSide,
                commentCount: thread.comments?.totalCount,
                firstCommentId: firstComment?.databaseId,
                firstCommentBody: firstComment?.body,
                firstCommentUrl: firstComment?.url,
                firstCommentAuthor: firstComment?.author?.login
            };
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
