    const apiCall = (context, { offset, limit }) => {
    return context.httpRequest({
        method: 'GET',
        url: `https://api.secured-api.com/v1/apigovern/posture/gaps?limit=${limit}&offset=${offset}`,
        headers: {
            'Authorization': `Bearer ${context.auth.apiKey}`
        }
    });
};

module.exports = {
    async receive(context) {
        const { limit: limitTotal } = context.messages.in.content;

        let records = [];
        let totalRecordsCount = 0;
        let itemsCount = 0;
        let offset = 0;

        do {
            const { data } = await apiCall(context, { limit: 100, offset });
            const { endOffset, response: items } = data;
            itemsCount = items.length;
            offset = endOffset;
            records = records.concat(items);
            totalRecordsCount += itemsCount;
            if (totalRecordsCount >= limitTotal) {
                records = records.slice(0, limitTotal);
                totalRecordsCount = limitTotal;
                break;
            }
        } while (itemsCount > 0);

        context.log({ step: 'results', totalRecordsCount });
        return context.sendArray(records, 'out');
    }
};
