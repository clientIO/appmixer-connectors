const { handleReceived } = require('./create-custom-rules-handler');

module.exports = {
    async receive() {
        return await handleReceived(context);
    }
};
