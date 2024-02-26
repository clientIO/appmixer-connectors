'use strict';
const { BigQuery } = require('@google-cloud/bigquery');
const commons = require("../../google-commons");

function parseInput(field, value) {

    const quotedTypes = [
        'string',
        'timestamp',
        'date',
        'time',
        'datetime'
    ]

    return quotedTypes.includes(field) ? `"${value}"` : value;
}

module.exports = {

    async receive(context) {

        const {
            projectId,
            datasetId,
            tableId,
            filter
        } = context.messages.in.content;

        const whereQuery = filter.OR.map((andObject) => {
            const andArray = andObject.AND;
            const andSentences = andArray.map((andClause) => {
                const { column, operator, value, type } = andClause;
                const transformedValue = parseInput(type, value);
                return `(${column} ${operator} ${transformedValue})`;
            }).join(' AND ');
            return `(${andSentences})`;
        }).join(' OR ');

        const client = new BigQuery({
            authClient: commons.getAuthLibraryOAuth2Client(context.auth),
            projectId
        });

        const query = `DELETE FROM \`${projectId}.${datasetId}.${tableId}\` WHERE ${whereQuery}`;
        await context.log({ step: 'query', query });

        const [job] = await client.createQueryJob({ query });
        await job.getQueryResults();

        return context.sendJson({}, 'out');
    }
}
