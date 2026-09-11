'use strict';

const lib = require('../../lib');

/**
 * Component for creating a review comment on a pull request — anchored to a line of the
 * diff, or to a whole file. The counterpart of Submit Review, which comments on the pull
 * request as a whole.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const {
            repositoryId,
            pullRequestNumber,
            body,
            path,
            subjectType = 'line',
            line,
            side = 'RIGHT',
            startLine,
            startSide,
            commitId
        } = context.messages.in.content;

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!pullRequestNumber) {
            throw new context.CancelError('Pull Request Number is required!');
        }
        if (!body) {
            throw new context.CancelError('Body is required!');
        }
        if (!path) {
            throw new context.CancelError('File Path is required!');
        }
        if (subjectType !== 'file' && !line) {
            throw new context.CancelError('Line is required when commenting on a line of the diff!');
        }

        // GitHub anchors the comment to a specific commit and rejects the request without
        // one. Defaulting to the head of the pull request is what a flow almost always
        // means, and saves it from having to look the SHA up first.
        let commit = commitId;
        if (!commit) {
            const { data: pullRequest } = await lib.apiRequest(
                context,
                `repos/${repositoryId}/pulls/${pullRequestNumber}`
            );
            commit = pullRequest.head?.sha;
            if (!commit) {
                throw new context.CancelError(
                    `Could not determine the head commit of pull request #${pullRequestNumber}. Set Commit SHA explicitly.`
                );
            }
        }

        const comment = { body, commit_id: commit, path };

        if (subjectType === 'file') {
            // A file-level comment carries no position at all; sending one alongside
            // subject_type: 'file' is what GitHub rejects.
            comment.subject_type = 'file';
        } else {
            comment.line = Number(line);
            comment.side = side;
            if (startLine) {
                comment.start_line = Number(startLine);
                comment.start_side = startSide || side;
            }
        }

        const { data } = await lib.apiRequest(
            context,
            `repos/${repositoryId}/pulls/${pullRequestNumber}/comments`,
            { method: 'POST', body: comment }
        );

        return context.sendJson(data, 'out');
    }
};
