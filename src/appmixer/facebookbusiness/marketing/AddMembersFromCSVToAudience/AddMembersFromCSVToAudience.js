const { randomInt, createHash } = require('crypto');
const { parse } = require('csv-parse');

const BATCH_SIZE = 10000;

module.exports = {

    async receive(context) {

        const { accountId, audienceId, fileId, schema } = context.messages.in.content;

        const schemaConfig = {};

        if (schema) {
            schema.ADD.forEach(item => {
                schemaConfig[item.csvHeader.toLowerCase().trim()] = item.fbType;
            });
        }

        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);

        const reader = fileStream.pipe(parse({
            columns: header => header.map(column => column.toLowerCase().trim())
        }));

        // randomInt limit is (max - min) < 2^48. See https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback.
        const sessionId = randomInt(0, 2 ** 48 - 1);
        let batch = [];
        let batchIndex = 0;
        let estimatedMembersCount = 0;
        let membersCount = 0;

        let numInvalidEntries = 0;
        let invalidEntrySamples = [];

        // Process rows in a way so that we can detect the last row (and therefore last batch).
        let previousRow = null;

        for await (const row of reader) {
            membersCount += 1;

            if (previousRow !== null) {
                batch.push(previousRow);
                if (batch.length >= BATCH_SIZE) {

                    if (batchIndex === 0) {
                        // First batch. Estimate the total number of members.
                        estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
                    }

                    const response = await sendBatchToFacebook(
                        context,
                        audienceId,
                        schemaConfig,
                        sessionId,
                        batch,
                        batchIndex,
                        false,
                        estimatedMembersCount
                    );
                    await context.log({ step: 'batch-response', data: response.data, headers: response.headers });
                    numInvalidEntries += response.data.num_invalid_entries;
                    invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
                    batchIndex += 1;
                    batch = []; // Clear the batch
                }
            }
            previousRow = row;
        }

        if (previousRow !== null) {
            batch.push(previousRow);
            if (!estimatedMembersCount) {
                estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
            }
            // Now process the last batch after loop ends.
            const response = await sendBatchToFacebook(
                context,
                audienceId,
                schemaConfig,
                sessionId,
                batch,
                batchIndex,
                true,
                estimatedMembersCount
            );
            await context.log({ step: 'batch-response', data: response.data, headers: response.headers });
            numInvalidEntries += response.data.num_invalid_entries;
            invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
        }

        return context.sendJson({
            account_id: accountId,
            audience_id: audienceId,
            num_invalid_entries: numInvalidEntries,
            invalid_entry_samples: invalidEntrySamples,
            num_total_entries: membersCount
        }, 'out');
    }
};

function getRandomUniqueElements(array, numElements) {

    if (numElements >= array.length) {
        return array;
    }

    const selectedIndices = new Set();
    const result = [];

    while (result.length < numElements) {
        const index = Math.floor(Math.random() * array.length);
        if (!selectedIndices.has(index)) {
            selectedIndices.add(index);
            result.push(array[index]);
        }
    }

    return result;
}

function estimateNumberOfRows(fileSize, batch) {

    // Estimate the number of rows in the file.
    // This is a very rough estimate and may not be accurate.
    // We don't want to loop over the entire batch rows. Instead,
    // we will randomly select a limited number of rows and calculate
    // the avarage row size in Bytes, then divide the total file size by this number.

    const randomRows = getRandomUniqueElements(batch, 20);
    let randomRowsSize = 0;
    for (const row of randomRows) {
        randomRowsSize += Buffer.from(Object.values(row).join('')).length;
    }
    const averageRowSize = randomRowsSize / randomRows.length;
    return Math.floor(fileSize / averageRowSize) + 1;
}

async function sendBatchToFacebook(
    context,
    audienceId,
    schemaConfig,
    sessionId,
    batch,
    batchIndex,
    isLastBatch,
    estimatedMembersCount) {

    const body = {
        payload: {
            schema: detectSchema(batch, schemaConfig),
            data: prepareMembers(batch, schemaConfig)
        },
        session: {
            session_id: sessionId,
            batch_seq: batchIndex + 1,
            last_batch_flag: isLastBatch,
            estimated_num_total: estimatedMembersCount
        },
        access_token: context.auth.accessToken
    };

    const url = `https://graph.facebook.com/v20.0/${audienceId}/users`;

    await context.log({ step: 'batch', schema: body.payload.schema, session: body.session, size: batch.length });

    return context.httpRequest.post(url, body);
}

function detectSchema(batch, schemaConfig) {

    let schema = [];
    for (const csvHeader in batch[0]) {
        if (schemaConfig[csvHeader]) {
            schema.push(schemaConfig[csvHeader]);
        }
    }
    return schema;
}

function prepareMembers(batch, schemaConfig) {

    return batch.map(member => {
        const memberData = [];
        for (const column in member) {
            if (schemaConfig[column]) {
                const value = createHash('sha256').update(member[column]).digest('hex');
                memberData.push(value);
            }
        }
        return memberData;
    });
}
