const resources = require('./resources.exposed');

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { filter, limit } = context.messages.in.content;

        let filterBy;
        if (filter) {
            try {
                filterBy = JSON.parse(filter);
            } catch (e) {
                throw new context.CancelError('Invalid Input: Filter', e);
            }
        }

        const records = await resources.getResources(context, { filterBy, limit });
        return context.sendArray(records, 'out');
    }
};
