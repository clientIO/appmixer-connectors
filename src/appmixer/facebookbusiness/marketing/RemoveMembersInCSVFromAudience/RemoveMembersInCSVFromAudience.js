const lib = require('../../lib');

module.exports = {

    async receive(context) {
        
        await lib.sendCSVAudienceToFacebook(context, 'delete', 'users');
    }
};
