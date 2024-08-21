const csv = require('csv-parser');

// Default schema config. This will be used if schema is not provided in the input.
let schemaConfig = {
    'email': 'EMAIL',
    'phone': 'PHONE_NUMBER',
    'first_name': 'FN',
    'last_name': 'LN'
};

module.exports = {

    async receive(context) {

        const { accountId, audienceId, fileId, schema } = context.messages.in.content;
        const accessToken = context.auth.accessToken;

        if (schema) {
            schemaConfig = {};
            schema.split(',').forEach(value => {
                const item = value.trim().split(':');
                const header = item[0].trim();
                const schemaKey = item[1].trim();
                schemaConfig[header] = schemaKey;
            });
        }

        const results = [];

        const fileStream = await context.getFileReadStream(fileId);
        return new Promise((resolve, reject) => {
            fileStream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('error', (err) => reject(err))
                .on('end', async () => {
                    const { schema, data } = detectSchemaAndPrepareData(results);

                    // Process in batches (https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences).
                    const batchSize = 5000;
                    for (let i = 0; i < data.length; i += batchSize) {
                        const batch = data.slice(i, i + batchSize);
                        const payload = {
                            schema: schema,
                            data: batch,
                            access_token: accessToken
                        };

                        const url = `https://graph.facebook.com/v20.0/${audienceId}?access_token=${accessToken}`;
                        try {
                            const response = await context.httpRequest.post(url, payload);
                            resolve(context.sendJson({ accountId, audienceId, ...response.data }, 'out'));
                        } catch (error) {
                            reject(error);
                        }
                    }
                });
        });
    }
};


// Detect schema and prepare data format
function detectSchemaAndPrepareData(users) {
    let detectedSchema = [];
    const data = users.map(user => {
        let userData = [];
        for (const key in user) {
            if (schemaConfig[key]) {
                userData.push(user[key]);
                if (!detectedSchema.includes(schemaConfig[key])) {
                    detectedSchema.push(schemaConfig[key]);
                }
            }
        }
        return userData;
    });
    return { schema: detectedSchema, data };
}
