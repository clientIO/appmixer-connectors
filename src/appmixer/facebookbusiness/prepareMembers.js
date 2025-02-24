const workerpool = require('workerpool');
const { createHash } = require('crypto');

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

workerpool.worker({
    prepareMembers
});

