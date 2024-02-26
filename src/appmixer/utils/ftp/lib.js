'use strict';

module.exports = {

    getAccessSecureType: function(secure = '') {

        const secureNormalized = (secure || '').trim().toLowerCase();
        return secureNormalized === 'implicit' ? 'implicit' : secureNormalized === 'yes';
    }
};
