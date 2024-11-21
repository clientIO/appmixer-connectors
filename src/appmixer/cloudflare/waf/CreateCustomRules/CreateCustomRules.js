const { handleReceived } = require('./create-custom-rules-handler');

module.exports = {
    async receive(context) {
        return await handleReceived(context);
    }
};
