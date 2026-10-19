'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'body'],
    properties: {
        'id': { 'type': 'integer', 'title': 'ID', 'example': 2384759211 },
        'nodeId': { 'type': 'string', 'title': 'Node ID', 'example': 'PRRC_kwDOAA12oc6abcde' },
        'body': { 'type': 'string', 'title': 'Body', 'example': 'This loop can be replaced by a single map().' },
        'htmlUrl': { 'type': 'string', 'title': 'HTML URL', 'example': 'https://github.com/Appmixer-ai/appmixer-connectors/pull/1259#discussion_r2384759211' },
        'pullRequestUrl': { 'type': 'string', 'title': 'Pull Request URL', 'example': 'https://api.github.com/repos/Appmixer-ai/appmixer-connectors/pulls/1259' },
        'pullRequestNumber': { 'type': 'integer', 'title': 'Pull Request Number', 'example': 1259 },
        'pullRequestReviewId': { 'type': 'integer', 'title': 'Pull Request Review ID', 'example': 3512480011 },
        'inReplyToId': { 'type': 'integer', 'title': 'In Reply To ID', 'example': 2384759100 },
        'path': { 'type': 'string', 'title': 'Path', 'example': 'src/appmixer/github/lib.js' },
        'line': { 'type': 'integer', 'title': 'Line', 'example': 42 },
        'startLine': { 'type': 'integer', 'title': 'Start Line', 'example': 38 },
        'side': { 'type': 'string', 'title': 'Side', 'example': 'RIGHT' },
        'subjectType': { 'type': 'string', 'title': 'Subject Type', 'example': 'line' },
        'diffHunk': { 'type': 'string', 'title': 'Diff Hunk', 'example': '@@ -38,7 +38,7 @@\n-    const items = [];\n+    const items = rows.map(toItem);' },
        'commitId': { 'type': 'string', 'title': 'Commit ID', 'example': '6dcb09b5b57875f334f61aebed695e2e4193db5e' },
        'authorAssociation': { 'type': 'string', 'title': 'Author Association', 'example': 'MEMBER' },
        'createdAt': { 'type': 'string', 'title': 'Created At', 'example': '2026-09-09T11:27:45Z' },
        'updatedAt': { 'type': 'string', 'title': 'Updated At', 'example': '2026-09-09T11:27:45Z' },
        'userLogin': { 'type': 'string', 'title': 'User Login', 'example': 'Copilot' },
        'userId': { 'type': 'integer', 'title': 'User ID', 'example': 198982749 },
        'userType': { 'type': 'string', 'title': 'User Type', 'example': 'Bot' }
    }
};

/**
 * Repository-wide search is deliberately capped at one page. GitHub answers 502 when
 * `/repos/{owner}/{repo}/pulls/comments` is paged through on a busy repository, so the
 * newest 100 comments are returned and the cap is logged rather than silently applied.
 */
const REPOSITORY_WIDE_PAGE_SIZE = 100;

/**
 * The PR number is the last segment of `pull_request_url`.
 * @param {Object} comment
 * @returns {Number|undefined}
 */
function pullRequestNumberOf(comment) {

    const last = (comment.pull_request_url || '').split('/').pop();
    return last ? Number(last) : undefined;
}

/**
 * Component for searching the inline review comments of a repository or of a single
 * pull request.
 * @extends {Component}
 */
module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            repositoryId,
            pullRequestNumber,
            author,
            authorType = 'any',
            since,
            outputType = 'array'
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Review Comments' });
        }

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }

        const params = { sort: 'updated', direction: 'desc' };
        if (since) params.since = since;

        let comments;
        if (pullRequestNumber) {
            // A single pull request's comments are a bounded set, so all pages are read.
            comments = await lib.apiRequestPaginated(
                context,
                `repos/${repositoryId}/pulls/${pullRequestNumber}/comments`,
                { params }
            );
        } else {
            const { data } = await lib.apiRequest(context, `repos/${repositoryId}/pulls/comments`, { params });
            comments = Array.isArray(data) ? data : [];
            if (comments.length === REPOSITORY_WIDE_PAGE_SIZE) {
                await context.log({
                    step: `Repository-wide search returns at most ${REPOSITORY_WIDE_PAGE_SIZE} most recently updated review comments. Narrow the search with Pull Request Number or Updated Since to be sure of seeing everything.`,
                    repositoryId
                });
            }
        }

        const matching = comments.filter(comment =>
            lib.matchesAuthor(comment.user?.login, author) && lib.matchesAuthorType(comment.user, authorType));

        if (!matching.length) {
            return context.sendJson({ repositoryId, pullRequestNumber }, 'notFound');
        }

        const records = matching.map(comment => ({
            id: comment.id,
            nodeId: comment.node_id,
            body: comment.body,
            htmlUrl: comment.html_url,
            pullRequestUrl: comment.pull_request_url,
            pullRequestNumber: pullRequestNumberOf(comment),
            pullRequestReviewId: comment.pull_request_review_id,
            inReplyToId: comment.in_reply_to_id,
            path: comment.path,
            line: comment.line,
            startLine: comment.start_line,
            side: comment.side,
            subjectType: comment.subject_type,
            diffHunk: comment.diff_hunk,
            commitId: comment.commit_id,
            authorAssociation: comment.author_association,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            userLogin: comment.user?.login,
            userId: comment.user?.id,
            userType: comment.user?.type
        }));

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
